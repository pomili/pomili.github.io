# pomili.github.io

pomili 的个人小站。

简洁清爽的个人主页与 Markdown 博客。使用 Astro、TypeScript 和原生 CSS，静态生成，无数据库，不加载外部字体或追踪脚本。

## 本地运行

需要 Node.js 24（建议使用最新的 24.x LTS）和 npm。

```bash
npm ci
npm run dev
```

本地开发地址以终端输出为准。其他命令：

```bash
npm run check     # Astro / TypeScript 检查
npm run build     # 生成 dist/
npm test          # 检查已构建的静态站点
npm run verify    # 检查 + 构建 + 测试
npm run preview   # 预览 dist/ 的生产版本
```

## 写文章

在 `src/content/blog/` 添加 `.md` 文件：

```markdown
---
title: '文章标题'
description: '一两句话的摘要'
pubDate: 2026-10-16
tags: ['笔记']
draft: false
---

正文从这里开始。

## 小标题

支持 Markdown、代码高亮、引用、列表和表格。
```

- 用实际发布日期替换示例日期，文章按日期倒序排列。
- 文件名决定 URL，建议使用 `a-short-note.md` 这样的名字，发布后尽量不改。
- `draft: true` 会从页面、列表、RSS 和站点地图中排除该文章。**公开仓库内的草稿源码仍然公开，不要提交私人内容。**
- 网站附带两篇明确的初始介绍/使用说明，可以修改、删除或设为草稿。
- 同一篇文章中的标题链接可用 `#标题锚点`。跨文章链接可用 `../hello-world/` 这样的相对网址；不要写死域名或项目仓库前缀。
- Markdown 图片可放在文章附近，通过相对路径引用，交由 Astro 处理；不要在正文里假设站点永远部署在 `/`。

## 修改个人资料和样式

- 站点标题、简介：`src/lib/site.ts`
- 首页与原创植物插画：`src/pages/index.astro`
- 关于页面：`src/pages/about.astro`
- 配色、字体、布局：`src/styles/global.css`
- 图标：`public/favicon.svg`
- 文章布局：`src/layouts/PostLayout.astro`

没有预设未经确认的个人履历、项目或联系邮箱；如需添加，请填入自己的真实资料。

## 部署到 GitHub Pages

工作流 `.github/workflows/deploy.yml` 会在推送 `main` 时检查并构建，再发布到 Pages。

1. 登录并确认自己的 GitHub 账号。
2. 将本项目上传到自己的公开仓库；个人站优先使用 `<账号>.github.io`。已有同名站点时不要直接覆盖。
3. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 推送到 `main`，在 **Actions** 查看部署。
5. 以部署任务给出的 `page_url` 为实际上线地址。

工作流根据仓库名自动设置根路径或项目子路径。例如：

- `pomili/pomili.github.io` → `https://pomili.github.io/`
- `pomili/notebook` → `https://pomili.github.io/notebook/`

本地默认域名为 `https://pomili.github.io`。如果账号不同，修改 `astro.config.mjs` 中的默认值。自定义域名需同步修改配置与工作流中的 `SITE_URL` / `SITE_BASE`，再自行设置 DNS 和 CNAME。

测试子目录部署：

```bash
SITE_BASE=/notebook/ npm run verify
npm run preview
```

构建产物始终为 `dist/`，不要再套一层仓库目录。GitHub Pages 会使用根目录的 `404.html` 作为错误页。

## 隐私与发布

不包含追踪、分析、在线表单或服务端账号。主题偏好仅保存在当前浏览器的 localStorage 中。发布前请检查 Git 暂存内容，不要上传 `.env`、token、私人文章或无授权素材。
