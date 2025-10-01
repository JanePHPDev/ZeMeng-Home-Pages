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

/* ==================== 配置 ==================== */
function parseConfig() {
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
    const [k, v] = l.split('=').map(s => s.trim());
    if (!conf[sec]) conf[sec] = {};
    conf[sec][k] = v;
  }
  return conf;
}
const CFG = parseConfig();
const SITE = CFG.site;
const BUILD = CFG.build;
const ROUTE = CFG.routing;

/* ==================== 日志 ==================== */
const LEVEL_COLOR = {
  info: chalk.blue('ℹ'),
  warn: chalk.yellow('⚠'),
  error: chalk.red('✖'),
  debug: chalk.gray('◆')
};
let logLevel = 'info';
function setLogLevel(l) {
  logLevel = l;
}
function _log(level, msg, ...args) {
  if (level === 'debug' && logLevel !== 'debug') return;
  const time = chalk.gray(new Date().toLocaleTimeString());
  console.log(`${time} ${LEVEL_COLOR[level]} ${msg}`, ...args);
}
const logger = {
  info(m, ...a) { _log('info', m, ...a); },
  warn(m, ...a) { _log('warn', m, ...a); },
  error(m, ...a) { _log('error', m, ...a); },
  debug(m, ...a) { _log('debug', m, ...a); },
  update(file) {
    const time = chalk.gray(new Date().toLocaleTimeString());
    console.log(`${time} ${chalk.cyan(file)} ${chalk.green('→')} ${chalk.magenta('热重载')}`);
  }
};

/* ==================== 工具 ==================== */
function fmtSize(b) {
  if (b > 1024) {
    return (b / 1024).toFixed(1) + ' KiB';
  }
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
  const src = await fs.readFile(filePath, 'utf-8');
  const { data: fm, content: md } = matter(src);
  const html = marked(md);
  const id = genId(md);

  let fileName;
  if (ROUTE.type === 'sequential') {
    fileName = '1.html'; // 每次全量重新编号，从 1 开始
  } else {
    fileName = `${id}.html`;
  }

  return {
    title: fm.title || path.basename(filePath, '.md'),
    categories: fm.categories || '未分类',
    date: fm.date || new Date().toISOString(),
    tags: ensureArray(fm.tags),
    content: html,
    excerpt: md.slice(0, 200) + '…',
    url: `${ROUTE.base_path}/${fileName}`,
    fileName,
    id
  };
}

/* ==================== 渲染 ==================== */
async function render(tpl, data, outFile) {
  const tplPath = path.join(BUILD.templates_dir, `${tpl}.ejs`);
  const html = await ejs.renderFile(tplPath, data, { filename: tplPath });
  await fs.outputFile(outFile, html);
  logger.debug(`写入 ${path.basename(outFile)}  ${fmtSize(Buffer.byteLength(html))}`);
}

/* ==================== 全量构建 ==================== */
async function build() {
  const start = performance.now();
  logger.info('开始全量构建…');

  // 1. 收集文章
  const files = await glob('**/*.md', { cwd: BUILD.posts_dir });
  const posts = [];
  for (const f of files) {
    const full = path.join(BUILD.posts_dir, f);
    posts.push(await parsePost(full));
  }
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 2. 清空输出目录
  await fs.remove(BUILD.output_dir);

  // 3. 渲染页面
  await render('index', { site: SITE, posts: posts.slice(0, 7), formatDate: fmtDate },
    path.join(BUILD.output_dir, 'index.html'));
  await render('post', { site: SITE, posts, formatDate: fmtDate },
    path.join(BUILD.output_dir, 'post.html'));
  for (const p of posts) {
    await render('article', { site: SITE, post: p, posts, formatDate: fmtDate },
      path.join(BUILD.output_dir, 'article', p.fileName));
  }

  // 4. build_data.json
  await fs.outputFile(
    path.join(BUILD.output_dir, 'build_data.json'),
    JSON.stringify({ generated: new Date().toISOString(), posts })
  );

  // 5. 拷贝静态资源
  if (await fs.pathExists(BUILD.assets_dir)) {
    await fs.copy(BUILD.assets_dir, path.join(BUILD.output_dir, 'assets'));
  }

  const cost = (performance.now() - start).toFixed(0);
  logger.info(`构建完成 (${cost} ms) 共 ${posts.length} 篇`);
}

/* ==================== 静态服务器 ==================== */
function serve(port) {
  const srv = http.createServer(async (req, res) => {
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
  });
  srv.listen(port, () => logger.info(`本地服务器运行中 → http://localhost:${port}`));
}

/* ==================== 监听模式 ==================== */
function watch(port) {
  build().then(() => serve(port));
  chokidar.watch(['config.conf', BUILD.templates_dir, BUILD.posts_dir], { ignored: /node_modules|\.git/ })
    .on('change', p => {
      logger.update(p);
      build();
    });
}

/* ==================== 入口 ==================== */
const argv = process.argv.slice(2);
let port = 4000;
const pIdx = argv.findIndex(a => a === '-p' || a === '--port');
if (pIdx !== -1 && argv[pIdx + 1]) {
  port = Number(argv[pIdx + 1]);
}
if (argv.includes('--debug')) {
  setLogLevel('debug');
}
if (argv.includes('--watch')) {
  watch(port);
} else {
  build();
}
