---
title: 用 Pagefind 给静态站装一个零后端搜索
description: 构建后扫描产物，生成可分片加载的索引。中文搜索会有哪些坑，怎么补。
pubDate: 2026-10-18
category: 工具链
tags: [搜索, Pagefind, 静态站]
draft: false
---

静态站最难补的能力是搜索。没有数据库，就没有 `LIKE` 查询；没有服务进程，就没有接口。Pagefind 的解法是把索引也变成静态文件，让浏览器自己查。

## 它怎么工作

构建结束后，Pagefind 扫描 `dist/` 里的 HTML，按页面切分索引，输出到 `dist/pagefind/`。索引被拆成很多小片，运行时只加载与查询相关的那几片。

```bash
astro build && pagefind --site dist
```

浏览器端不需要打包 Pagefind，直接用动态 `import()` 拉运行时：

```ts
const pagefind = await import(/* @vite-ignore */ '/pagefind/pagefind.js');
await pagefind.options({ excerptLength: 30 });
const search = await pagefind.search(keyword);
const items = await Promise.all(search.results.slice(0, 10).map((r) => r.data()));
```

这种做法有两个好处：首屏不加任何搜索代码；只有用户真正开始搜索时才付出加载成本。

## 让索引只包含正文

默认情况下 Pagefind 会索引整页，包括导航、页脚、版权声明。结果是搜「订阅」可能命中每一个页面。

解决办法是给正文容器加 `data-pagefind-body`。一旦页面里出现这个属性，Pagefind 就只索引它内部的内容：

```html
<article data-pagefind-body>
  <h1 data-pagefind-meta="title">用 Pagefind 给静态站装一个零后端搜索</h1>
  <time data-pagefind-meta="date:2026-10-18">2026.10.18</time>
  <div class="prose">…</div>
</article>
```

标题、日期、类型这些结构化信息用 `data-pagefind-meta` 单独声明，搜索结果里就能直接展示，不必从摘要里猜。

## 中文搜索的真实问题

Pagefind 默认对空白分词，英文体验很好，中文就一般。因为中文没有词边界，一长串字符会被当成一个整体。

我做了三件事来补偿：

1. 标题与标签提高权重，让精确命中的文章排前面。
2. 摘要截断到 30 个词，避免结果行过长。
3. 空态直接给出热门标签，引导用户用站内已有的词搜索。

搜索精度不会因为这三条变成完美，但对一个文章量不大的个人博客来说，够用。

### 构建期检查

搜索最容易出问题的地方不是查询，而是索引根本没生成。部署脚本里加一条断言，缺失就直接失败：

```bash
test -f dist/pagefind/pagefind.js || (echo "search index missing" && exit 1)
```

> 一个「看起来有搜索框、实际搜不到东西」的站点，比没有搜索更伤害信任。

## 搜索框的交互细节

- 首屏不加载索引，聚焦输入框后才拉取
- 输入防抖 250ms，避免每个字符都触发查询
- 结果行显示类型、标题、摘要、日期
- `Esc` 关闭搜索层，焦点回到入口按钮
- 没有结果时给明确文案，而不是空白

这些细节不涉及算法，却决定了搜索「像不像一个正经功能」。

## 最后

Pagefind 不是万能的。它不适合需要实时数据、需要权限过滤、需要复杂排序的场景。但对于一个纯静态、文章数量在几百篇以内的博客，它是最省心的方案——没有服务器，没有账单，也没有需要维护的索引服务。
