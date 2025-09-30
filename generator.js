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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ====== 配置解析 ====== */
function parseConfig() {
  const raw = fs.readFileSync('config.conf', 'utf-8');
  const conf = {};
  let sec = '';
  raw.split('\n').forEach(l => {
    l = l.trim();
    if (l.startsWith('[') && l.endsWith(']')) sec = l.slice(1, -1);
    else if (l && sec) {
      const [k, v] = l.split('=').map(s => s.trim());
      conf[sec] = { ...(conf[sec] || {}), [k]: v };
    }
  });
  return conf;
}
const CFG = parseConfig();
const SITE = CFG.site;
const BUILD = CFG.build;
const ROUTE = CFG.routing;
const FEAT = CFG.features;

/* ====== 工具函数 ====== */
const log = (msg, color = 'gray') => console.log(chalk[color](`[${new Date().toLocaleTimeString()}] ${msg}`));
const fmtSize = b => (b > 1024 ? (b / 1024).toFixed(1) + ' KiB' : b + ' B');

function ensureArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(s => s.trim()).filter(Boolean);
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

function fmtDate(d) {
  return new Date(d).toLocaleString('zh-CN');
}

function genId(content) {
  return ROUTE.type === 'md5'
    ? crypto.createHash('md5').update(content).digest('hex').slice(0, 5)
    : null;
}

/* ====== Markdown 处理 ====== */
marked.use({
  renderer: {
    code(code, lang) {
      const language = lang || 'none';
      return `<pre class="language-${language}"><code class="language-${language}">${code}</code></pre>`;
    }
  }
});


function parsePost(filePath, idx) {
  const src = fs.readFileSync(filePath, 'utf-8');
  const { data: fm, content: md } = matter(src);
  const html = marked(md);
  const id = genId(md);
  const fileName = ROUTE.type === 'sequential' ? `${idx + 1}.html` : `${id}.html`;
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

function loadPosts() {
  const dir = BUILD.posts_dir;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files
    .map((f, i) => parsePost(path.join(dir, f), i))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/* ====== 渲染 ====== */
async function render(tpl, data, out) {
  const tplPath = path.join(BUILD.templates_dir, `${tpl}.ejs`);
  const html = await ejs.renderFile(tplPath, data, { filename: tplPath });
  await fs.outputFile(out, html);
  const bytes = Buffer.byteLength(html, 'utf8');
  log(`写入 ${out}  (${fmtSize(bytes)})`, 'cyan');
}

/* ====== 构建流程 ====== */
async function build() {
  log('开始构建…', 'green');
  await fs.remove(BUILD.output_dir);
  const posts = loadPosts();
  log(`共 ${posts.length} 篇文章`, 'blue');

  await render('index', { site: SITE, posts: posts.slice(0, 5), formatDate: fmtDate },
    path.join(BUILD.output_dir, 'index.html'));

  await render('post', { site: SITE, posts, formatDate: fmtDate },
    path.join(BUILD.output_dir, 'post.html'));
    
await render('gists', { site: SITE }, path.join(BUILD.output_dir, 'gists.html'));

  for (const p of posts) {
    await render('article', { site: SITE, post: p, posts, formatDate: fmtDate },
      path.join(BUILD.output_dir, 'article', p.fileName));
  }

  await fs.outputFile(
    path.join(BUILD.output_dir, 'build_data.json'),
    JSON.stringify({ generated: new Date().toISOString(), posts }, null, 2)
  );

  if (await fs.pathExists(BUILD.assets_dir)) {
    await fs.copy(BUILD.assets_dir, path.join(BUILD.output_dir, 'assets'));
  }
  log('构建完成！', 'green');
}

/* ====== 静态文件服务器 ====== */
function serve(port = 4000) {
  const srv = http.createServer(async (req, res) => {
    let file = path.join(BUILD.output_dir, req.url === '/' ? '/index.html' : req.url);
    if (!(await fs.pathExists(file))) {
      res.writeHead(404); res.end('404'); return;
    }
    const stat = await fs.stat(file);
    if (stat.isDirectory()) file = path.join(file, 'index.html');
    const ext = path.extname(file).slice(1);
    res.writeHead(200, { 'Content-Type': mime.getType(ext) || 'text/plain' });
    fs.createReadStream(file).pipe(res);
  });
  srv.listen(port, () => log(`本地服务器运行中 → http://localhost:${port}`, 'magenta'));
}

/* ====== 监听模式 ====== */
function watch() {
  build().then(() => serve());
  chokidar.watch(['config.conf', BUILD.templates_dir, BUILD.posts_dir], { ignored: /node_modules/ })
    .on('change', () => {
      log('检测到变更，重新构建…', 'yellow');
      build();
    });
}

/* ====== CLI ====== */
const argv = process.argv.slice(2);
if (argv.includes('--watch')) watch();
else build();