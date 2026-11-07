# MISIRO 技术博客实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-11-04-misiro-blog-design.md` v1.1 交付一个可构建、可部署的静态技术博客，含 13 个路由与符合主题的动效系统。

**Architecture:** Astro 5 纯静态输出，构建期读取 content collections（Zod 校验）、Shiki 高亮、Pagefind 搜索索引、RSS/Sitemap；客户端仅保留主题切换、动效、搜索与灯箱四类小脚本。

**Tech Stack:** Astro 5 · TypeScript strict · Tailwind CSS v4（`@tailwindcss/vite`）· Pagefind · Shiki（内置）· pnpm · Cloudflare Pages。

---

## 文件结构

```
src/
├─ content.config.ts          # collections + Zod
├─ content/
│  ├─ posts/*.md              # 文章
│  ├─ notes/*.md              # 手记
│  ├─ albums/*.md             # 相册元数据
│  └─ friends/*.md            # 友链
├─ styles/
│  ├─ tokens.css              # 色彩/字体/时长/缓动 token
│  ├─ base.css                # reset、排版、焦点、动效降级
│  └─ components.css          # 贴纸、警示条、索引行、HUD、灯箱
├─ lib/
│  ├─ site.ts                 # 站点常量
│  ├─ content.ts              # 文章查询、阅读时长、相关文章
│  └─ format.ts               # 日期与数字格式化
├─ layouts/
│  ├─ BaseLayout.astro        # HTML 壳、SEO、主题初始化、ClientRouter
│  └─ PostLayout.astro        # 文章壳 + 目录 + 进度
├─ components/
│  ├─ Header.astro Footer.astro ThemeToggle.astro
│  ├─ Hero.astro FeaturedDossier.astro SectionHead.astro
│  ├─ IndexRow.astro NoteItem.astro TagMatrix.astro
│  ├─ Toc.astro ReadingProgress.astro SearchBox.astro
│  ├─ PhotoWall.astro FriendsGrid.astro Sticker.astro
├─ scripts/
│  ├─ intro.ts                # 首屏扫描线入场（会话一次）
│  ├─ reveal.ts               # 视口揭示、磁吸、聚光、路由过渡
│  ├─ post.ts                 # 目录高亮、进度条、代码复制
│  ├─ search.ts               # Pagefind 按需加载
│  ├─ lightbox.ts             # 相册灯箱 + 键盘
│  └─ nav.ts                  # 移动端抽屉、Esc 关闭
└─ pages/                     # / · /posts/[...slug] · /archives · /categories[/name]
                              # /tags[/name] · /search · /notes · /albums[/slug]
                              # /friends · /about · /projects · /404 · /rss.xml
```

---

## Task 1: 工程脚手架

**Files:** `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `.prettierrc`

- [ ] 初始化 `package.json`（`"type": "module"`），安装：`astro @astrojs/rss @astrojs/sitemap tailwindcss @tailwindcss/vite sharp @fontsource/archivo-black @fontsource/jetbrains-mono @fontsource/noto-sans-sc`；开发依赖：`pagefind @astrojs/check typescript prettier prettier-plugin-astro`。
- [ ] `astro.config.mjs`：`output: 'static'`，`site: 'https://misiro.pages.dev'`，integrations `[sitemap()]`，vite `plugins: [tailwind()]`，`build.inlineStylesheets: 'auto'`。
- [ ] 脚本：`dev` / `build: astro build && pagefind --site dist` / `preview` / `check`。
- [ ] 验证：`pnpm build` 在空页面下通过。

## Task 2: 设计 Token 与全局样式

**Files:** `src/styles/tokens.css`, `base.css`, `components.css`

- [ ] `tokens.css` 写入第 7.2 与 7.6.2 节全部 token；深色为默认，`html[data-theme="light"]` 覆盖；`--font-display/--font-sans/--font-mono`。
- [ ] `base.css`：reset、正文 17px/1.75、焦点环 2px 荧光 + 2px offset、`scroll-margin-top: 96px`、减少动效与粗指针降级、`::view-transition` 关键帧。
- [ ] `components.css`：贴纸（纯色偏移投影）、警示条 45° 斜纹、编号索引行、HUD 角标、网点底纹、灯箱、代码块。
- [ ] 验证：`pnpm dev` 首屏无 FOUC，深浅切换无白闪。

## Task 3: 站点配置与内容集合

**Files:** `src/lib/site.ts`, `src/content.config.ts`, `src/content/**`, `src/lib/format.ts`, `src/lib/content.ts`

- [ ] `site.ts`：站点名 MISIRO、描述、导航项、社交链接、建站年份。
- [ ] `content.config.ts`：`posts`（title/description/pubDate/updatedDate?/category/tags/cover?/draft/featured/lang?）、`notes`（date/type/content/image?）、`albums`（title/date/cover/photos[{src,caption}]）、`friends`（name/url/avatar/description）。`type=image` 时 `image` 必填（superRefine）。
- [ ] 示例内容：4 篇文章（1 篇 featured，含代码块、多级标题）、4 条手记、2 个相册、6 条友链。
- [ ] `content.ts`：`getPosts()` 过滤 draft 并按日期倒序；`readingTime()`；`relatedPosts()` 按共享标签数排序取 3；`allTags()`/`allCategories()` 计数。
- [ ] 验证：`pnpm astro sync && pnpm check` 无 schema 错误。

## Task 4: 基础布局、导航与主题

**Files:** `BaseLayout.astro`, `Header.astro`, `Footer.astro`, `ThemeToggle.astro`, `src/scripts/nav.ts`

- [ ] BaseLayout：`lang=zh-CN`、唯一 title/description/canonical、OG、JSON-LD 插槽、内联主题脚本（`localStorage` 优先，默认深色）、`<ClientRouter />`、跳过链接。
- [ ] Header：Logo（自绘几何 SVG）、文章/归档/标签/手记/相册/友链/关于、搜索入口、主题切换、移动端抽屉（`Esc` 关闭、焦点陷阱）。
- [ ] Footer：站点信息、RSS、GitHub、版权、网点底纹、HUD 角标。
- [ ] 验证：375px 无横向滚动，Tab 可达，切页无白屏。

## Task 5: 首页

**Files:** `pages/index.astro`, `Hero.astro`, `FeaturedDossier.astro`, `IndexRow.astro`, `NoteItem.astro`, `TagMatrix.astro`, `SectionHead.astro`

- [ ] Hero：7/5 不对称分栏、Display 标题逐行 clip-path 揭示、两个按钮（读最新 / RSS）、统计（文章数/总字数/起始年份）。
- [ ] FeaturedDossier：`featured: true` 唯一一篇，dossier 面板 + 编号 + 分类 + 日期。
- [ ] 全部文章：编号索引行最多 8 条；手记摘要 3 条；标签矩阵三档字号 + RSS。
- [ ] 验证：首屏入场 ≤ 900ms，单帧并行动画 ≤ 3。

## Task 6: 文章详情

**Files:** `pages/posts/[...slug].astro`, `PostLayout.astro`, `Toc.astro`, `ReadingProgress.astro`, `src/scripts/post.ts`

- [ ] 面包屑 → 分类 → H1 → 日期/阅读时长/标签；description 摘要块；正文 680px。
- [ ] 右侧 sticky 目录（H2/H3 抽取，编号 + 3px 荧光竖条，`scaleY` 过渡）。
- [ ] 顶部 2px 阅读进度（`animation-timeline: scroll()` + scroll 事件降级）。
- [ ] Shiki 双主题代码块 + 语言标签 + 复制按钮（`COPIED` 反馈 2s 复位）。
- [ ] 文末：版权、上下篇、同标签相关文章 3 篇、RSS 入口。
- [ ] 验证：目录高亮随滚动准确，复制写入剪贴板，进度条到文末为 100%。

## Task 7: 归档 / 分类 / 标签 / 搜索

**Files:** `pages/archives.astro`, `pages/categories/index.astro`, `pages/categories/[name].astro`, `pages/tags/index.astro`, `pages/tags/[name].astro`, `pages/search.astro`, `src/scripts/search.ts`, `SearchBox.astro`

- [ ] 归档：年份 Display 字号 + 年份跳转锚点 + 索引行。
- [ ] 分类：清单行（名称+数量+最新标题）；标签：三档字号矩阵，无彩色胶囊。
- [ ] 搜索：Pagefind 动态 import、首屏不加载索引、聚焦后才拉取；结果含类型徽标/标题/摘要/日期；空态热门标签；`/` 聚焦、`Esc` 关闭。
- [ ] 验证：构建后 `pnpm preview` 搜索「Rust」返回相关文章，`/pagefind/pagefind.js` 可加载。

## Task 8: 手记 / 相册 / 友链 / 关于 / 项目 / 404

**Files:** 对应 `pages/*.astro`, `PhotoWall.astro`, `FriendsGrid.astro`, `src/scripts/lightbox.ts`

- [ ] 手记：时间倒序、细线分隔、超过 6 行折叠展开、可选单图。
- [ ] 相册列表 + 相册详情图片墙；灯箱 FLIP 240ms、`←/→` 翻页、`Esc` 关闭、焦点陷阱、caption 与序号。
- [ ] 友链：分组列表 + GitHub Issue 申请入口 + 审核说明。
- [ ] 关于：介绍、技能、时间线、联系方式；项目：编号列表。
- [ ] 404：错位三次后静止、搜索框、返回首页。
- [ ] 验证：灯箱键盘翻页与关闭正常；375px 图片墙不溢出。

## Task 9: 动效系统

**Files:** `src/scripts/intro.ts`, `reveal.ts`, `post.ts`, `nav.ts`, `tokens.css`

- [ ] 首屏扫描线 + 逐行揭示 + 贴纸弹入 + 索引行依次进入，`sessionStorage` 只播放一次。
- [ ] 路由切换：旧页上移淡出 120ms、新页 clip-path 揭示 200ms、顶部荧光线扫过、焦点移到主标题。
- [ ] 反馈层：索引行左移、贴纸回正、按钮色块滑入、磁吸 6px、标题 RGB 错位单次。
- [ ] 降级：`prefers-reduced-motion` 仅保留 ≤120ms 透明度；`pointer: coarse` 关聚光与磁吸；`saveData` 关共享元素。
- [ ] 验证：开启减少动效后功能完整；Lighthouse 性能 ≥ 90。

## Task 10: RSS / Sitemap / SEO / 统计

**Files:** `pages/rss.xml.ts`, `public/robots.txt`, `astro.config.mjs`, `BaseLayout.astro`

- [ ] RSS 2.0（标题、描述、日期、链接、分类）。
- [ ] Sitemap 由 integration 生成；robots 指向 sitemap。
- [ ] 文章页 `BlogPosting` JSON-LD；OG 缺省站点图。
- [ ] Cloudflare Web Analytics beacon 仅在 `PUBLIC_CF_ANALYTICS_TOKEN` 存在时注入。
- [ ] 验证：`dist/rss.xml` 与 `dist/sitemap-index.xml` 可解析。

## Task 11: 构建与验收

- [ ] `pnpm build` 零错误；Pagefind 生成 `dist/pagefind/`。
- [ ] 13 个路由全部产出 HTML。
- [ ] 对照设计文档第 11 章逐条自查，记录未达成项与原因。

---

## 已知取舍

| 项 | 取舍 | 原因 |
| --- | --- | --- |
| 中文字体 | Archivo Black / JetBrains Mono 自托管；标题中文回退系统 900 黑体，同时引入 Noto Sans SC 900 的 unicode-range 子集 | 控制首屏字体体积 < 80KB |
| 文章封面 | CSS 自绘几何海报，不使用外部图片 | 主题一致、零外部请求 |
| 相册图片 | 生成后下载到 `src/assets`，构建期转 AVIF/WebP | 满足静态资源与性能预算 |
