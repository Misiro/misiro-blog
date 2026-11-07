---
title: View Transitions：让路由切换不出现白屏的 200 毫秒
description: 不用框架路由，也能让页面切换有方向感。拆解原生 View Transitions 的时序与降级路径。
pubDate: 2026-10-28
category: 前端
tags: [动效, CSS, 路由]
draft: false
---

页面切换是最容易被忽略的体验断点。点击链接，白屏闪一下，新内容出现——大多数站点默认如此，用户也默认如此。但「默认」不等于「只能这样」。

## 白屏是怎么来的

传统多页应用在导航时会销毁旧文档、请求新文档、重新布局。浏览器在这段时间里没有内容可画，于是留下白屏。View Transitions 的思路是把「旧状态」和「新状态」各截一张图，在两帧之间做动画。

```css
::view-transition-old(root) {
  animation: vt-out 120ms cubic-bezier(0.65, 0, 0.35, 1) both;
}

::view-transition-new(root) {
  animation: vt-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

旧页上移 6px 并淡出，新页用 `clip-path` 从下往上揭示。两个动画重叠 80ms，视觉上就不会有中断。

### 方向感比时长更重要

200ms 是这类切换的舒适区。再快会显得仓促，再慢会让用户等待。真正决定「顺滑」的，是方向：

- 旧页向上离开，暗示「翻页」
- 新页自下而上揭示，与旧页形成连续关系
- 顶部一条 1px 荧光线从左扫到右，给视线一个落点

三者同时发生，但只有一个主动作。其余两个是辅助，不能抢戏。

## 共享元素

列表页与详情页之间，最有价值的衔接是标题。做法是给点击的那一行标题临时设置 `view-transition-name`，详情页的主标题声明同名：

```ts
document.addEventListener('click', (event) => {
  const link = (event.target as HTMLElement)?.closest('[data-post-link]');
  if (!link) return;
  const title = link.querySelector('.index-row__title');
  if (title) (title as HTMLElement).style.viewTransitionName = 'post-title';
});
```

浏览器会把旧位置和新位置之间的矩形插值，标题看起来是「飞过去」的，而不是重新出现。只在支持 View Transitions 的浏览器生效，不支持的浏览器只是普通跳转，没有副作用。

## 降级不是可选项

任何动效方案都必须回答三个问题：

1. 用户开启「减少动态效果」时，页面还能不能读？
2. 触屏设备上，悬停类效果会不会卡住？
3. 脚本加载失败时，内容会不会被隐藏？

我的处理方式是让动效只做增强。初始状态永远是可见的，动画通过属性选择器叠加，而不是反过来「先隐藏再显示」。这样即使脚本挂了，最坏结果也只是没有动画。

> 一个好的动效系统，应该在关闭 JavaScript 之后仍然保证内容完整。

## 别引入滚动劫持

有些站点为了让滚动「更顺滑」，会接管滚轮事件。这类库通常会破坏键盘翻页、触控板惯性和浏览器自带的锚点跳转。原生 `scroll-behavior: smooth` 加 `scroll-margin-top` 已经足够，没必要为此付出可访问性代价。

## 最后

路由切换是用户进入站点后遇到的第一个「系统级」动作。它值得被认真设计，但不值得为此引入一整套动画框架。CSS 加一个事件监听，够了。
