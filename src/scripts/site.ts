const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => window.matchMedia('(pointer: fine)').matches;

/* ---------- 主题 ---------- */
const THEME_KEY = 'misiro-theme';

function storedTheme(): 'light' | 'dark' {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyThemeColor(theme: 'light' | 'dark') {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#F2F1EC' : '#0E0F12';
}

/* 路由切换会重写 <html> 的所有属性，交换前先把当前主题带到新文档 */
document.addEventListener('astro:before-swap', (event) => {
  const theme = storedTheme();
  const root = event.newDocument.documentElement;
  root.dataset.theme = theme;
  root.classList.add('js');
});

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLElement>('[data-theme-toggle]');
  if (!button) return;

  const root = document.documentElement;
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
  applyThemeColor(next);
});

/* ---------- 移动端导航 ---------- */
function setMenu(open: boolean) {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  header.dataset.open = open ? 'true' : 'false';
  const button = header.querySelector<HTMLElement>('[data-menu-toggle]');
  button?.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('is-locked', open);
  if (open) {
    header.querySelector<HTMLElement>('.nav a')?.focus();
  }
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  if (target.closest('[data-menu-toggle]')) {
    const header = document.querySelector<HTMLElement>('[data-header]');
    setMenu(header?.dataset.open !== 'true');
    return;
  }
  if (target.closest('[data-menu-close]') || target.closest('.nav a')) {
    setMenu(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

/* ---------- 全局快捷键 / 搜索 ---------- */
document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
  if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;

  const input = document.querySelector<HTMLInputElement>('[data-search-input]');
  if (input) {
    event.preventDefault();
    input.focus();
  } else {
    event.preventDefault();
    window.location.href = '/search';
  }
});

/* ---------- 头部滚动态 ---------- */
function syncHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  header.dataset.scrolled = window.scrollY > 8 ? 'true' : 'false';

  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  header.style.setProperty('--head-progress', progress.toFixed(3));
}

/* ---------- 即刻时间流 ---------- */
let flowFrame = 0;
let flowTarget: {
  flow: HTMLElement;
  body: HTMLElement;
  readout: HTMLElement | null;
} | null = null;

function syncFlow() {
  if (!flowTarget) return;
  const { flow, body, readout } = flowTarget;
  const rect = body.getBoundingClientRect();
  const anchor = window.innerHeight * 0.52;
  const progress = Math.max(
    0,
    Math.min(1, (anchor - rect.top) / Math.max(1, rect.height))
  );
  flow.style.setProperty('--flow-progress', progress.toFixed(3));
  if (readout) {
    readout.textContent = `${String(Math.round(progress * 100)).padStart(2, '0')}%`;
  }
}

function initFlow() {
  const flow = document.querySelector<HTMLElement>('[data-flow]');
  const body = flow?.querySelector<HTMLElement>('[data-flow-body]');
  const readout = flow?.querySelector<HTMLElement>('[data-flow-readout]');
  flowTarget = flow && body ? { flow, body, readout: readout ?? null } : null;
  syncFlow();
}

function requestFlowSync() {
  if (flowFrame) return;
  flowFrame = requestAnimationFrame(() => {
    flowFrame = 0;
    syncFlow();
  });
}

window.addEventListener(
  'scroll',
  () => {
    syncHeader();
    requestFlowSync();
  },
  { passive: true }
);

window.addEventListener('resize', () => {
  syncHeader();
  requestFlowSync();
}, { passive: true });

/* ---------- 主页即刻采样器 ---------- */
const LIVE_CYCLE = 34_000;

let liveState: {
  root: HTMLElement;
  slides: HTMLElement[];
  ticks: HTMLElement[];
  index: number;
  progress: number;
  paused: boolean;
} | null = null;

function setLiveActive(index: number) {
  if (!liveState || liveState.index === index) return;
  liveState.index = index;

  liveState.slides.forEach((slide, i) => {
    const active = i === index;
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', String(!active));
    slide.tabIndex = active ? 0 : -1;
  });

  liveState.ticks.forEach((tick, i) => {
    const active = i === index;
    tick.classList.toggle('is-active', active);
    if (active) tick.setAttribute('aria-current', 'true');
    else tick.removeAttribute('aria-current');
  });
}

function applyLive(progress: number) {
  if (!liveState) return;
  const clamped = Math.max(0, Math.min(1, progress));
  liveState.progress = clamped;
  liveState.root.style.setProperty('--scan', `${(clamped * 100).toFixed(2)}%`);
  const index = Math.min(
    liveState.slides.length - 1,
    Math.floor(clamped * liveState.slides.length)
  );
  setLiveActive(index);
}

function setLivePaused(paused: boolean) {
  if (!liveState) return;
  liveState.paused = paused;
  liveState.root.dataset.paused = paused ? 'true' : 'false';
}

function initLive() {
  liveState = null;

  const root = document.querySelector<HTMLElement>('[data-live-feed]');
  if (!root) return;

  const slides = [...root.querySelectorAll<HTMLElement>('[data-live-slide]')];
  const ticks = [...root.querySelectorAll<HTMLElement>('[data-live-tick]')];
  if (slides.length === 0) return;

  liveState = { root, slides, ticks, index: -1, progress: 0, paused: false };

  root.addEventListener('pointerenter', () => setLivePaused(true));
  root.addEventListener('pointerleave', () => setLivePaused(false));
  root.addEventListener('focusin', () => setLivePaused(true));
  root.addEventListener('focusout', (event) => {
    const next = event.relatedTarget as Node | null;
    if (!next || !root.contains(next)) setLivePaused(false);
  });

  root.addEventListener('click', (event) => {
    const tick = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-live-tick]');
    if (!tick) return;
    const index = ticks.indexOf(tick);
    if (index < 0) return;
    applyLive((index + 0.5) / slides.length);
  });

  if (prefersReduced()) {
    setLiveActive(slides.length - 1);
    return;
  }

  applyLive(0);

  let last = performance.now();
  const loop = (now: number) => {
    if (!liveState || liveState.root !== root) return;
    const delta = Math.min(1200, now - last);
    last = now;
    if (!liveState.paused) {
      const next = liveState.progress + delta / LIVE_CYCLE;
      applyLive(next >= 1 ? 0 : next);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/* ---------- 首屏入场 ---------- */
function runIntro() {
  const root = document.documentElement;
  if (root.dataset.intro !== 'pending') return;

  if (prefersReduced()) {
    root.dataset.intro = 'done';
    return;
  }

  const animations: Animation[] = [];
  const play = (element: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    if (!element) return;
    animations.push(element.animate(keyframes, { fill: 'both', ...options }));
  };

  const scan = document.querySelector('.intro-scan');
  play(
    scan,
    [
      { transform: 'translateY(-10vh)', opacity: 0 },
      { opacity: 1, offset: 0.08 },
      { transform: 'translateY(100vh)', opacity: 1 },
    ],
    { duration: 480, delay: 80, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  );

  document.querySelectorAll('[data-intro-line]').forEach((line, index) => {
    play(
      line,
      [
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0 0)' },
      ],
      {
        duration: 260,
        delay: 320 + index * 60,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      }
    );
  });

  document.querySelectorAll('[data-intro-sticker]').forEach((sticker) => {
    play(
      sticker,
      [
        { opacity: 0, transform: 'scale(0.92) rotate(6deg)' },
        { opacity: 1, transform: 'scale(1) rotate(3deg)' },
      ],
      {
        duration: 320,
        delay: 440,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      }
    );
  });

  document.querySelectorAll('[data-intro-row]').forEach((row, index) => {
    play(
      row,
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      {
        duration: 200,
        delay: 560 + Math.min(index, 6) * 40,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      }
    );
  });

  const finish = () => {
    root.dataset.intro = 'done';
    animations.forEach((animation) => animation.cancel());
  };

  if (animations.length === 0) {
    finish();
    return;
  }

  Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(finish);
}

/* ---------- 视口揭示 ---------- */
function initReveal() {
  const items = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter(
    (item) => !item.classList.contains('is-visible')
  );
  if (items.length === 0) return;

  if (prefersReduced() || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );

  items.forEach((item) => observer.observe(item));
}

/* ---------- 首屏聚光与磁吸 ---------- */
function initSpotlight() {
  const hero = document.querySelector<HTMLElement>('[data-spotlight]');
  if (!hero || !finePointer() || prefersReduced()) return;

  let frame = 0;
  hero.addEventListener('pointermove', (event) => {
    if (frame) return;
    const rect = hero.getBoundingClientRect();
    frame = requestAnimationFrame(() => {
      hero.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
      hero.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
      hero.style.setProperty('--spot-on', '1');
      frame = 0;
    });
  });

  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--spot-on', '0');
  });
}

function initMagnetic() {
  if (!finePointer() || prefersReduced()) return;

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((button) => {
    button.addEventListener('pointermove', (event) => {
      const rect = button.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      button.style.setProperty('--mag-x', `${Math.max(-6, Math.min(6, dx / 6))}px`);
      button.style.setProperty('--mag-y', `${Math.max(-6, Math.min(6, dy / 6))}px`);
    });
    button.addEventListener('pointerleave', () => {
      button.style.setProperty('--mag-x', '0px');
      button.style.setProperty('--mag-y', '0px');
    });
  });
}

/* ---------- 大标题字符场 ---------- */
function initTitleField() {
  const title = document.querySelector<HTMLElement>('[data-title-field]');
  if (!title || title.dataset.fieldReady === '1') return;
  title.dataset.fieldReady = '1';

  title.querySelectorAll<HTMLElement>('[data-intro-line]').forEach((line) => {
    const text = line.textContent ?? '';
    line.textContent = '';
    Array.from(text).forEach((char) => {
      const span = document.createElement('span');
      span.className = 'title-char';
      span.textContent = char === ' ' ? '\u00a0' : char;
      line.appendChild(span);
    });
  });

  if (!finePointer() || prefersReduced()) return;

  const chars = [...title.querySelectorAll<HTMLElement>('.title-char')];
  if (chars.length === 0) return;

  let frame = 0;
  let pointer: { x: number; y: number } | null = null;

  const update = () => {
    frame = 0;
    const point = pointer;
    if (!point) return;

    const radius = Math.max(
      150,
      Math.min(240, title.getBoundingClientRect().width * 0.24)
    );

    chars.forEach((char) => {
      const rect = char.getBoundingClientRect();
      const distance = Math.hypot(
        point.x - (rect.left + rect.width / 2),
        point.y - (rect.top + rect.height / 2)
      );
      const proximity = Math.max(0, 1 - distance / radius);
      const eased = proximity * proximity;
      char.style.setProperty('--prox', eased.toFixed(3));
      char.style.setProperty('--p', `${(eased * 100).toFixed(1)}%`);
    });
  };

  title.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(update);
  });

  title.addEventListener('pointerleave', () => {
    pointer = null;
    chars.forEach((char) => {
      char.style.setProperty('--prox', '0');
      char.style.setProperty('--p', '0%');
    });
  });
}

/* ---------- 页脚交互 ---------- */
let clockTimer = 0;

function initFooter() {
  const word = document.querySelector<HTMLElement>('[data-wordmark]');
  if (word && finePointer() && !prefersReduced() && word.dataset.ready !== '1') {
    word.dataset.ready = '1';

    const move = (event: PointerEvent) => {
      const rect = word.getBoundingClientRect();
      word.style.setProperty('--word-x', `${event.clientX - rect.left}px`);
      word.style.setProperty('--word-y', `${event.clientY - rect.top}px`);
    };

    word.addEventListener('pointerenter', (event) => {
      move(event);
      const rect = word.getBoundingClientRect();
      word.style.setProperty(
        '--word-r',
        `${Math.min(240, Math.max(120, rect.height * 0.9))}px`
      );
    });
    word.addEventListener('pointermove', move);
    word.addEventListener('pointerleave', () => {
      word.style.setProperty('--word-r', '0px');
    });
  }

  const clock = document.querySelector<HTMLElement>('[data-clock]');
  window.clearInterval(clockTimer);
  clockTimer = 0;
  if (!clock) return;

  const format = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const tick = () => {
    clock.textContent = `${format.format(new Date())} CST`;
  };

  tick();
  clockTimer = window.setInterval(tick, 1000);
}

/* ---------- 手记折叠 ---------- */
function initNotes() {
  document.querySelectorAll<HTMLElement>('.note-item').forEach((item) => {
    if (item.dataset.foldReady) return;
    item.dataset.foldReady = '1';
    const body = item.querySelector<HTMLElement>('.note-item__body');
    const button = item.querySelector<HTMLElement>('[data-note-toggle]');
    if (!body || !button) return;
    if (body.scrollHeight > 200) {
      body.dataset.clamped = 'true';
      button.hidden = false;
    }
  });
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLElement>('[data-note-toggle]');
  if (!button) return;
  const body = button.closest('.note-item')?.querySelector<HTMLElement>('.note-item__body');
  if (!body) return;

  if (body.hasAttribute('data-clamped')) {
    body.removeAttribute('data-clamped');
    button.textContent = '收起 −';
    button.setAttribute('aria-expanded', 'true');
  } else {
    body.setAttribute('data-clamped', 'true');
    button.textContent = '展开 +';
    button.setAttribute('aria-expanded', 'false');
  }
});

/* ---------- 共享元素 ---------- */
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const link = target?.closest<HTMLAnchorElement>('[data-post-link]');
  if (!link) return;
  if (!('startViewTransition' in document)) return;
  const title = link.querySelector<HTMLElement>('[data-post-title]');
  if (title) title.style.viewTransitionName = 'post-title';
});

/* ---------- 路由切换后 ---------- */
document.addEventListener('astro:after-swap', () => {
  document.body.classList.remove('is-locked');
  applyThemeColor(storedTheme());

  const main = document.querySelector('main');
  const heading = main?.querySelector<HTMLElement>('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }

  if (prefersReduced()) return;
  const scan = document.querySelector('.intro-scan');
  scan?.animate(
    [
      { opacity: 0, transform: 'translateY(0)' },
      { opacity: 1, offset: 0.15 },
      { opacity: 1, transform: 'translateY(100vh)' },
    ],
    { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  );
});

document.addEventListener('astro:page-load', () => {
  setMenu(false);
  syncHeader();
  initReveal();
  initSpotlight();
  initMagnetic();
  initNotes();
  initFlow();
  initLive();
  initTitleField();
  initFooter();
});

runIntro();
