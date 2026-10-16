# pomili.github.io

pomili 的个人小站。

参考布局风格的个人主页与 Markdown 博客：全屏背景首页、可展开侧边栏、移动端菜单、文章卡片，以及右下角的目录 / 回顶 / 深浅色工具。使用 Astro、TypeScript 和原生 CSS，静态生成，无数据库；字体随站点自托管，不加载远程字体服务或追踪脚本。

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
- 文件名决定文章 URL，例如 `a-short-note.md` 对应 `/blog/a-short-note/`（项目部署时还会加上 `SITE_BASE` 前缀），发布后尽量不改。
- `draft: true` 会从文章页面、列表、标签、归档、RSS、站点地图和搜索索引中排除该文章。**公开仓库内的草稿源码仍然公开，不要提交私人内容。**
- 网站附带初始介绍/使用说明，可以修改、改名、删除或设为草稿；静态测试不会要求保留特定初始文章或篇数。
- 文章正文建议从 `##` 开始，页面自动生成标题与目录；右下角目录按钮会展示正文标题。站内搜索使用构建时生成的 `search-index.json`，只收录已发布文章的标题、摘要、标签和纯文本正文。
- 同一篇文章中的标题链接可用 `#标题锚点`。跨文章链接可用 `../hello-world/` 这样的相对网址；不要写死域名或项目仓库前缀。
- Markdown 图片可放在文章附近，通过相对路径引用，交由 Astro 处理；不要在正文里假设站点永远部署在 `/`。

## 导航与页面切换

`src/lib/navigation.ts` 定义桌面与移动端共用的八个导航入口：

| 页面 | 路径 |
| --- | --- |
| 首页 | `/` |
| 文章 | `/posts/` |
| 标签 | `/tags/` |
| 归档 | `/archives/` |
| 关于 | `/aboutme/` |
| 友链 | `/friends/` |
| 推广 | `/promotion/` |
| 搜索 | `/search/` |

这些路径均通过 `pathTo()` 添加部署前缀。旧的 `/blog/` 列表和 `/about/` 页面仍可访问，canonical 分别指向 `/posts/` 和 `/aboutme/`，站点地图不重复收录这两个兼容入口。文章本身继续使用 `/blog/<文章 ID>/`，旧文章链接无需迁移。友链与推广页目前是明确的空状态，不会虚构合作或推荐内容。

`src/scripts/site.ts` 使用 Swup 及其 Head 插件，在站内切换时替换 `#swup-main` 并更新标题、元数据与 canonical；侧边栏、移动导航和浮动工具保留。每次切换后重新绑定搜索、目录与滚动状态，并清理上一页监听器。首次加载遮罩有超时保护，禁用 JavaScript 时默认隐藏；所有页面本身都是静态 HTML，普通链接仍可直接访问（交互式搜索、菜单与主题按钮需要 JavaScript）。减弱动态效果偏好会关闭或缩短动画。

## 修改个人资料、图片和样式

- 站点标题、简介、头像与响应式背景路径：`src/lib/site.ts`
- 首页布局：`src/pages/index.astro`
- 导航入口：`src/lib/navigation.ts`；导航外壳：`src/components/Header.astro`
- 关于内容：`src/components/AboutContent.astro`；主入口：`src/pages/aboutme/index.astro`
- 配色、字体回退、布局和响应式断点：`src/styles/global.css`
- 图标：`public/favicon.svg`；文章布局与目录模板：`src/layouts/PostLayout.astro`
- 主题、导航、加载与搜索交互：`src/scripts/site.ts`

当前图片是仓库内的 **SVG 占位插画，不是真正 AI 生成的位图 / 栅格图片，也不是参考站的原始素材**。默认路径对应如下：

| `site.ts` 配置项 | 占位文件 |
| --- | --- |
| `avatar` | `public/images/avatar.svg` |
| `banners.desktop` | `public/images/banner.svg` |
| `banners.tablet` | `public/images/banner-tablet.svg` |
| `banners.mobile` | `public/images/banner-mobile.svg` |

替换时把有权使用的图片放在 `public/images/`，并更新 `site.ts` 中相应的 `images/...` 路径（不加 `public/`、域名或部署前缀）；`pathTo()` 会处理根路径或项目子路径。可以换成 JPG、WebP、PNG 等图片，建议分别为桌面、平板和手机准备合适裁切。替换占位图并不会自动生成新图片，请自行准备素材并确认授权。

没有预设未经确认的个人履历、项目或联系邮箱；如需添加，请填入自己的真实资料。

## 字体与授权

Inter 用于西文界面文字，JetBrains Mono 用于代码与技术风格标签；中文按系统字体回退。字体通过 `@fontsource/inter` 与 `@fontsource/jetbrains-mono` 在构建时打包到本站 `_astro/`，不向 Google Fonts 或其他字体 CDN 请求资源。

两款字体均使用 **SIL Open Font License 1.1**。随站发布的完整版权和授权文本在 `public/licenses/inter.txt` 与 `public/licenses/jetbrains-mono.txt`（上线后为 `/licenses/inter.txt` 与 `/licenses/jetbrains-mono.txt`，项目站需加部署前缀）。重新分发字体时请保留这些声明；如修改字体，还需遵守 OFL 的保留字体名称等条件。自备图片或替换字体应另行确认其授权，不能用字体授权代替素材授权。

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
