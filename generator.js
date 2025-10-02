#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import { marked } from 'marked';
import matter from 'gray-matter';
import crypto from 'crypto';
import chokidar from 'chokidar';
import chalk from 'chalk';
import http from 'http';
import mime from 'mime';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ==================== 全局错误处理器 ==================== */
process.on('uncaughtException', (err) => {
  logger.error(`未捕获异常: ${err.message}`);
  process.exit(1);
});

/* ==================== Logo ==================== */
const LOGO = `
${chalk.cyan("  ____             _            ")}
${chalk.cyan(" |  _ \\  ___  _ __| |_ ___ _ __ ")}
${chalk.cyan(" | | | |/ _ \\| '__| __/ _ \\ '__|")}
${chalk.cyan(" | |_| | (_) | |  | ||  __/ |   ")}
${chalk.cyan(" |____/ \\___/|_|   \\__\\___|_|   ")}
${chalk.magenta("ZeBlog")}
`;

/* ==================== 配置 ==================== */
function parseConfig() {
  try {
    if (!fs.existsSync('config.conf')) {
      throw new Error('config.conf 文件不存在');
    }
    const raw = fs.readFileSync('config.conf', 'utf-8');
    const conf = {};
    let sec = '';
    for (const line of raw.split('\n')) {
      const l = line.trim();
      if (l.startsWith('[') && l.endsWith(']')) {
        sec = l.slice(1, -1);
        continue;
      }
      if (!l || !sec) continue;
      const eqIdx = l.indexOf('=');
      if (eqIdx === -1) continue;
      const k = l.substring(0, eqIdx).trim();
      const v = l.substring(eqIdx + 1).trim();
      if (k.startsWith('#') || !k) continue;
      if (!conf[sec]) conf[sec] = {};
      // 处理数组格式（如 [tech] - name: PHP）
      if (v.startsWith('- ')) {
        const itemStr = v.slice(2).trim();
        const itemMatch = itemStr.match(/(.+?):\s*(.+)/);
        if (itemMatch) {
          const key = itemMatch[1].trim();
          const val = itemMatch[2].trim();
          if (!conf[sec][k]) conf[sec][k] = [];
          const item = {};
          item[key] = val;
          conf[sec][k].push(item);
        } else {
          if (!conf[sec][k]) conf[sec][k] = [];
          conf[sec][k].push(itemStr);
        }
      } else {
        conf[sec][k] = v;
      }
    }
    // 验证核心配置
    if (!conf.build || !conf.build.posts_dir || !conf.build.templates_dir || !conf.build.output_dir) {
      throw new Error('build 部分缺少必要配置 (posts_dir, templates_dir, output_dir)');
    }
    if (!conf.site || !conf.site.base_url) {
      throw new Error('site.base_url 配置缺失');
    }
    return conf;
  } catch (err) {
    console.error(chalk.red('✖ 配置解析失败: ' + err.message));
    process.exit(1);
  }
}
const CFG = parseConfig();
const SITE = CFG.site;
const BUILD = CFG.build;
const ROUTE = CFG.routing || {};
const FEATURES = CFG.features || {};
const SOCIAL = CFG.social || {};
const TECH = CFG.tech || [];
const GISTS = CFG.gists || [];

/* ==================== 日志 ==================== */
const LEVEL_COLOR = {
  info: chalk.blue('ℹ'),
  warn: chalk.yellow('⚠'),
  error: chalk.red('✖'),
  debug: chalk.gray('◆'),
  dev: chalk.green('▶')
};
const levelPriority = {
  debug: 1,
  dev: 2,
  info: 3,
  warn: 4,
  error: 5
};
let logLevel = 'info';
function setLogLevel(l) {
  logLevel = l;
}
function applyStyle(text, styleStr) {
  if (!styleStr || !text) return text;
  const styles = styleStr.trim().split(/\s+/);
  let styleChain = chalk;
  for (const s of styles) {
    if (s in styleChain) {
      styleChain = styleChain[s];
    } else {
      break;
    }
  }
  if (typeof styleChain === 'function') {
    return styleChain(text);
  }
  return text;
}
function processMsg(msg, args) {
  const parts = msg.split(/(%c)/g);
  let result = '';
  let argIdx = 0;
  for (let k = 0; k < parts.length; k++) {
    if (k % 2 === 0) {
      result += parts[k];
    } else {
      // '%c'
      if (argIdx < args.length) {
        const style = args[argIdx++];
        const textIdx = k + 1;
        let text = '';
        if (textIdx < parts.length) {
          text = parts[textIdx];
          k++; // skip the text part
        }
        result += applyStyle(text, style);
      } else {
        result += '%c'; // fallback
      }
    }
  }
  return result;
}
function _log(level, msg, ...args) {
  const msgPri = levelPriority[level] || 5;
  const logPri = levelPriority[logLevel] || 3;
  if (msgPri < logPri) return;
  const time = chalk.gray(`[${new Date().toLocaleTimeString()}]`);
  const prefix = `${time} ${LEVEL_COLOR[level] || ''} `;
  const coloredMsg = processMsg(msg, args);
  console.log(`${prefix}${coloredMsg}`);
}
const logger = {
  info(m, ...a) { _log('info', m, ...a); },
  warn(m, ...a) { _log('warn', m, ...a); },
  error(m, ...a) { 
    _log('error', m, ...a);
    if (logLevel === 'debug') console.trace(); // 打印栈追踪
  },
  debug(m, ...a) { _log('debug', m, ...a); },
  dev(m, ...a) { _log('dev', m, ...a); },
  update(file) {
    const time = chalk.gray(`[${new Date().toLocaleTimeString()}]`);
    console.log(`${time} ${chalk.cyan(path.basename(file))} ${chalk.green('→')} ${chalk.magenta('热重载')}`);
  }
};

/* ==================== 工具 ==================== */
function fmtSize(b) {
  if (b > 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MiB';
  if (b > 1024) return (b / 1024).toFixed(1) + ' KiB';
  return b + ' B';
}
function ensureArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(s => s.trim()).filter(Boolean);
  return v.split(',').map(s => s.trim()).filter(Boolean);
}
function fmtDate(d) {
  return new Date(d).toLocaleString('zh-CN');
}
function genId(content) {
  if (ROUTE.type === 'md5') {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 5);
  }
  return null;
}

/* ==================== Markdown ==================== */
marked.use({
  renderer: {
    code(code, lang) {
      const language = lang || 'none';
      return `<pre class="language-${language}"><code class="language-${language}">${code}</code></pre>`;
    }
  }
});

/* ==================== 解析文章 ==================== */
async function parsePost(filePath) {
  try {
    const src = await fs.readFile(filePath, 'utf-8');
    const { data: fm, content: md } = matter(src);
    const html = marked(md);
    const id = genId(md);

    return {
      title: fm.title || path.basename(filePath, '.md'),
      categories: fm.categories || '未分类',
      date: fm.date || new Date().toISOString(),
      tags: ensureArray(fm.tags),
      content: html,
      excerpt: md.slice(0, 200) + '…',
      id,
      cover: fm.cover  // 支持 FM 中的 cover
    };
  } catch (err) {
    logger.warn(`解析文章失败 ${filePath}: ${err.message}`);
    return null;
  }
}

/* ==================== 渲染 ==================== */
async function render(tpl, data, outFile) {
  try {
    const tplPath = path.join(BUILD.templates_dir, `${tpl}.ejs`);
    if (!await fs.pathExists(tplPath)) {
      throw new Error(`模板文件不存在: ${tpl}.ejs`);
    }
    // 统一注入配置到 data
    const fullData = {
      ...data,
      site: SITE,
      features: FEATURES,
      social: SOCIAL,
      tech: TECH,
      gists: GISTS,
      formatDate: fmtDate
    };
    const html = await ejs.renderFile(tplPath, fullData, { filename: tplPath });
    await fs.outputFile(outFile, html);
    logger.debug(`%c写入 %c${path.basename(outFile)} %c${fmtSize(Buffer.byteLength(html))}`, 'gray', 'blue', 'gray');
  } catch (err) {
    logger.error(`渲染失败 ${tpl} → ${outFile}: ${err.message}`);
    throw err;
  }
}

/* ==================== 生成 Sitemap ==================== */
async function generateSitemap(posts, outputDir, hasGists) {
  try {
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE.base_url}/</loc><lastmod>${new Date().toISOString()}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE.base_url}/post.html</loc><lastmod>${new Date().toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`;
    if (hasGists) {
      sitemap += `\n  <url><loc>${SITE.base_url}/gists.html</loc><lastmod>${new Date().toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`;
    }
    sitemap += `${posts.map(p => `\n  <url><loc>${SITE.base_url}${p.url}</loc><lastmod>${p.date}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`).join('')}\n`;
    sitemap += `</urlset>`;
    await fs.outputFile(path.join(outputDir, 'sitemap.xml'), sitemap);
    logger.debug('生成 sitemap.xml');
  } catch (err) {
    logger.warn(`生成 sitemap 失败: ${err.message}`);
  }
}

/* ==================== 构建报告 ==================== */
async function buildReport(outputDir, posts) {
  try {
    const files = await glob('**/*', { cwd: outputDir, nodir: true });
    let totalSize = 0;
    const report = files.map(f => {
      const fullPath = path.join(outputDir, f);
      const size = fs.statSync(fullPath).size;
      totalSize += size;
      return { file: f, size: fmtSize(size) };
    });
    report.sort((a, b) => b.size.localeCompare(a.size)); // 粗略排序

    logger.info('%c=== 构建报告 ===', 'bold cyan');
    logger.info(`总文件数: %c${files.length}`, 'yellow');
    logger.info(`总大小: %c${fmtSize(totalSize)}`, 'green');
    logger.info(`文章数: %c${posts.length}`, 'magenta');
    logger.info('%c文件列表:', 'bold blue');
    report.forEach(({ file, size }) => {
      logger.info(`  %c${file.padEnd(30)} %c${size}`, 'dim', 'gray');
    });
    logger.info('%c===============', 'bold cyan');
  } catch (err) {
    logger.warn(`生成构建报告失败: ${err.message}`);
  }
}

/* ==================== 显示文件列表 (Dev模式) ==================== */
async function listBuildFiles(outputDir) {
  try {
    const files = await glob('**/*', { cwd: outputDir, nodir: true });
    logger.dev('%c=== Dev 构建文件列表 ===', 'bold green');
    files.forEach(f => logger.dev(`  %c${f}`, 'cyan'));
    logger.dev('%c======================', 'bold green');
  } catch (err) {
    logger.warn(`列出构建文件失败: ${err.message}`);
  }
}

/* ==================== 全量构建 ==================== */
async function build() {
  const start = performance.now();
  logger.info('开始全量构建…');

  try {
    // 验证目录
    if (!fs.existsSync(BUILD.posts_dir)) {
      throw new Error(`posts_dir 不存在: ${BUILD.posts_dir}`);
    }
    if (!fs.existsSync(BUILD.templates_dir)) {
      throw new Error(`templates_dir 不存在: ${BUILD.templates_dir}`);
    }

    // 1. 收集文章
    const files = await glob('**/*.md', { cwd: BUILD.posts_dir });
    const posts = [];
    for (const f of files) {
      const full = path.join(BUILD.posts_dir, f);
      const post = await parsePost(full);
      if (post) posts.push(post);
    }
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Assign fileName and url
    posts.forEach((post, index) => {
      if (ROUTE.type === 'sequential') {
        post.fileName = `${index + 1}.html`;
      } else if (post.id) {
        post.fileName = `${post.id}.html`;
      } else {
        post.fileName = `post-${index + 1}.html`;
      }
      post.url = `/${ROUTE.base_path || 'article'}/${post.fileName}`;
    });

    // 2. 清空输出目录
    await fs.remove(BUILD.output_dir);

    // 3. 渲染页面
    await render('index', { posts: posts.slice(0, 7) },
      path.join(BUILD.output_dir, 'index.html'));
    await render('post', { posts },
      path.join(BUILD.output_dir, 'post.html'));
    // 处理 gists.ejs，如果存在且有 gists
    let hasGists = false;
    const gistsTpl = path.join(BUILD.templates_dir, 'gists.ejs');
    if (await fs.pathExists(gistsTpl) && GISTS.length > 0) {
      await render('gists', {},
        path.join(BUILD.output_dir, 'gists.html'));
      hasGists = true;
      logger.dev('渲染 gists.html');
    }

    // 并行渲染文章
    await Promise.all(posts.map(p => 
      render('article', { post: p, posts },
        path.join(BUILD.output_dir, 'article', p.fileName))
        .catch(err => {
          logger.warn(`渲染文章失败 ${p.title}: ${err.message}`);
        })
    ));

    // 4. build_data.json
    await fs.outputFile(
      path.join(BUILD.output_dir, 'build_data.json'),
      JSON.stringify({ generated: new Date().toISOString(), posts })
    );

    // 5. 生成 sitemap.xml
    await generateSitemap(posts, BUILD.output_dir, hasGists);

    // 6. 拷贝静态资源
    if (await fs.pathExists(BUILD.assets_dir)) {
      await fs.copy(BUILD.assets_dir, path.join(BUILD.output_dir, 'assets'));
    }

    const cost = (performance.now() - start).toFixed(0);
    logger.info(`构建完成 (${cost} ms) 共 ${posts.length} 篇`);

    // 7. 构建报告 (仅 build 模式)
    if (logLevel === 'info') {
      await buildReport(BUILD.output_dir, posts);
    }
  } catch (err) {
    logger.error(`构建失败: ${err.message}`);
    process.exit(1);
  }
}

/* ==================== 静态服务器 ==================== */
function serve(port) {
  const srv = http.createServer(async (req, res) => {
    try {
      let file = path.join(BUILD.output_dir, req.url === '/' ? '/index.html' : req.url);
      if (!(await fs.pathExists(file))) {
        res.writeHead(404);
        res.end('404');
        return;
      }
      if ((await fs.stat(file)).isDirectory()) {
        file = path.join(file, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': mime.getType(path.extname(file).slice(1)) || 'text/plain' });
      fs.createReadStream(file).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
      logger.error(`服务器错误: ${err.message}`);
    }
  });
  srv.listen(port, () => logger.info(`本地服务器运行中 → http://localhost:${port}`));
}

/* ==================== 监听模式 (Dev) ==================== */
function watch(port) {
  build().then(async () => {
    await listBuildFiles(BUILD.output_dir);
    serve(port);
  }).catch(err => {
    logger.error(`Dev 模式启动失败: ${err.message}`);
    process.exit(1);
  });
  chokidar.watch(['config.conf', BUILD.templates_dir, BUILD.posts_dir], { ignored: /node_modules|\.git/ })
    .on('change', p => {
      logger.update(p);
      build();
    });
}

/* ==================== 入口 ==================== */
console.log(LOGO);

const argv = process.argv.slice(2);
let port = 4000;
const pIdx = argv.findIndex(a => a === '-p' || a === '--port');
if (pIdx !== -1 && argv[pIdx + 1]) {
  const p = parseInt(argv[pIdx + 1], 10);
  if (isNaN(p) || p < 1 || p > 65535) {
    console.error(chalk.red('✖ 无效端口号，必须是1-65535的整数'));
    process.exit(1);
  }
  port = p;
}

let mode = 'build';
if (argv.includes('--debug')) {
  setLogLevel('debug');
  mode = 'DeBug';
  console.log(chalk.yellow(mode));
} else if (argv.includes('--watch')) {
  setLogLevel('dev');
  mode = 'Dev';
  console.log(chalk.blue(mode));
} else {
  setLogLevel('info');
  mode = 'build';
  console.log(chalk.green(mode));
}

if (argv.includes('--watch')) {
  watch(port);
} else {
  build();
}