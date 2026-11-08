// 将 ```mermaid 代码块渲染为 SVG 图。检测到页面含 mermaid 块时才动态加载库。
import type { Mermaid } from 'mermaid';

let mermaid: Mermaid | null = null;
let renderSeq = 0;

function themeVars() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    vars: {
      background: 'transparent',
      fontFamily: v('--font-mono'),
      fontSize: '14px',
      primaryColor: v('--bg-elevated-2'),
      primaryTextColor: v('--text'),
      primaryBorderColor: v('--line-strong'),
      lineColor: v('--text-muted'),
      textColor: v('--text'),
      clusterBkg: 'transparent',
      clusterBorder: v('--line'),
      edgeLabelBackground: v('--bg-elevated'),
      mainBkg: v('--bg-elevated-2'),
      nodeBorder: v('--line-strong'),
      titleColor: v('--text-muted'),
    },
  };
}

async function renderAll(container: ParentNode) {
  // 未渲染的代码块 + 已渲染但主题切换后需要重画的图
  const targets = [
    ...container.querySelectorAll<HTMLPreElement>('pre[data-language="mermaid"]'),
    ...container.querySelectorAll<HTMLElement>('.mermaid-figure[data-source]'),
  ];
  if (targets.length === 0) return;

  if (!mermaid) mermaid = (await import('mermaid')).default;
  const { vars } = themeVars();
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: vars,
    flowchart: {
      curve: 'basis',
      padding: 14,
      nodeSpacing: 36,
      rankSpacing: 40,
      diagramPadding: 16,
      wrappingWidth: 260,
    },
    // SVG 内联在页面里，直接引用站点 CSS 变量，亮暗主题自动适配
    themeCSS: `
      .node rect, .node polygon, .node circle { rx: 10px; ry: 10px; stroke-width: 1.2px; }
      .node.accent rect { fill: var(--accent); stroke: var(--accent); filter: drop-shadow(0 0 6px rgba(216,255,62,0.35)); }
      .node.accent .nodeLabel, .node.accent .nodeLabel p, .node.accent .nodeLabel span { color: #0e0f12 !important; font-weight: 700; }
      .cluster rect { fill: transparent; stroke: var(--line); stroke-dasharray: 4 6; rx: 14px; stroke-width: 1px; }
      .cluster .nodeLabel { color: var(--accent-text); font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; }
      .edgePath path { stroke-width: 1.5px; }
      .edgePath .arrowheadPath { stroke-width: 0.6px; }
      .edgeLabel rect { fill: var(--bg-elevated-2); stroke: var(--line-strong); rx: 4px; }
      .edgeLabel .nodeLabel { font-family: var(--font-mono); font-size: var(--fs-micro); }
    `,
  });

  for (const el of targets) {
    const source = el instanceof HTMLPreElement ? (el.textContent ?? '') : (el.dataset.source ?? '');
    if (!source.trim()) continue;
    try {
      const { svg } = await mermaid.render(`mermaid-${++renderSeq}`, source);
      const figure = document.createElement('div');
      figure.className = 'mermaid-figure';
      figure.dataset.source = source;
      figure.innerHTML = svg;
      el.replaceWith(figure);
    } catch {
      // 语法错误时保留源码块，不破坏文章
    }
  }
}

function init() {
  void renderAll(document);

  // 主题切换后重画，保持配色一致
  let lastTheme = document.documentElement.dataset.theme;
  new MutationObserver(() => {
    if (document.documentElement.dataset.theme !== lastTheme) {
      lastTheme = document.documentElement.dataset.theme;
      void renderAll(document);
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

document.addEventListener('astro:page-load', () => void renderAll(document));
init();
