# ZeBlog - 静态博客生成器

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ZeBlog 是一个轻量级的 Node.js 静态博客生成器，灵感来源于 Hexo 和 Hugo。使用 EJS 模板、Markdown 文章，支持主题切换、代码高亮（Prism.js）和自定义配置。适合开发者快速搭建个人博客或文档站点。

## 特性
- **Markdown 支持**：使用 `marked` 解析，支持 frontmatter 元数据（标题、标签、日期等）。
- **主题系统**：配置 `theme` 切换模板（如 `templates/default/`），每个主题可有独立 `assets/`（CSS/JS/图片）。
- **静态资源管理**：自动拷贝 `content/public/` 到 `output/public/`、`templates/${theme}/assets/` 到 `output/assets/`、`data/` 到根目录。
- **热重载开发**：`--watch` 模式下，修改配置/模板/文章自动重建。
- **Sitemap 生成**：自动创建 `sitemap.xml`。
- **自定义配置**：INI-like 格式，支持站点信息、技术栈列表、Gists 等。
- **路由生成**：支持 MD5 或序号 ID 的文章 URL。

## 快速开始

### 1. 安装
确保 Node.js >= 18。

```bash
git clone https://github.com/JanePHPDev/ZeBlog.git
cd ZeBlog
npm install
```

### 2. 配置
编辑 `config.conf`：
- 设置 `[site]`：标题、描述、base_url 等。
- `[build]`：`theme = default`（默认主题）。
- `[tech]` 和 `[gists]`：自定义列表（YAML 风格）。

示例配置见 `config.conf`。

### 3. 目录结构
```
ZeBlog/
├── config.conf          # 主配置
├── generator.js         # 构建脚本
├── content/
│   ├── posts/           # Markdown 文章 (*.md)
│   └── public/          # 全局静态资源 → output/public/
├── templates/           # 模板目录
│   └── default/         # 默认主题
│       ├── index.ejs    # 首页模板
│       ├── article.ejs  # 文章模板
│       └── assets/      # 主题资源 → output/assets/
├── data/                # 数据文件 → output/ 根目录
└── package.json
```

### 4. 添加文章
在 `content/posts/Example.md` 创建测试文章（见示例）。

### 5. 构建与预览
```bash
# 构建静态文件
npm run build  # 生成 output/

# 开发模式（热重载，端口 4000）
npm run dev

# 指定端口
npm run dev -- -p 3000  # http://localhost:3000
```

构建后，`output/` 包含：
- `index.html`：首页
- `article/*.html`：文章页
- `public/`、`assets/`：静态文件夹
- `sitemap.xml`：站点地图

### 6. 部署
将 `output/` 内容上传到静态主机（如 GitHub Pages、Vercel）。更新 `base_url` 为你的域名。

## 用法详解

### 配置格式 (config.conf)
- **节**：`[site]`、`[build]` 等。
- **键值**：`key = value`。
- **列表**：如 `[gists]` 用 `- item`；`[tech]` 用 `- name: PHP` + 缩进属性。

详见 `config.conf` 示例。

### 模板 (EJS)
- 在 `templates/${theme}/` 下编辑 `*.ejs`。
- 注入数据：`<%= site.title %>`、`<% tech.forEach(item => { %> ... <% }) %>`。
- 代码高亮：启用 `features.prismjs = true`。

### 文章 Frontmatter
```yaml
---
title: 文章标题
date: 2025-10-01
tags: [tag1, tag2]
categories: 分类
cover: /assets/image.jpg
---
正文...
```

### 自定义主题
1. 创建 `templates/mytheme/`，复制 `default/`。
2. 编辑 `config.conf`：`theme = mytheme`。
3. 在 `mytheme/assets/css/styles.css` 加样式，模板中 `<link href="/assets/css/styles.css">`。

## 故障排除
- **模板不存在**：检查 `templates_dir` 和 `theme` 配置，路径如 `templates/default/index.ejs`。
- **tech/gists 缺失**：确保缩进正确（空格，非 Tab），最后一个项需在文件末尾保存。
- **热重载无效**：确认 chokidar 监听路径（config、templates、posts、assets）。
- **依赖问题**：`npm install` 后重试。

## 贡献
欢迎 PR！Fork 仓库，添加功能/主题，提交到 `develop` 分支。

## 许可证
MIT License - 详见 LICENSE。

---

**作者**：JanePHPDev  
**版本**：1.0.0  
**更新**：2025-10-01