interface PagefindResult {
  url: string;
  excerpt: string;
  meta?: Record<string, string>;
}

interface PagefindModule {
  options: (options: Record<string, unknown>) => Promise<void>;
  search: (query: string) => Promise<{ results: { data: () => Promise<PagefindResult> }[] }>;
}

let pagefind: PagefindModule | null = null;
let loadPromise: Promise<void> | null = null;
let debounceTimer: number | undefined;
let queryToken = 0;

function safeExcerpt(html: string): string {
  return html.replace(/<(?!\/?mark>)/g, '&lt;');
}

function renderEmpty(results: HTMLElement, message: string) {
  results.innerHTML = '';
  const state = document.createElement('div');
  state.className = 'empty-state';
  state.textContent = message;
  results.append(state);
}

function renderResults(results: HTMLElement, items: PagefindResult[]) {
  results.innerHTML = '';

  if (items.length === 0) {
    renderEmpty(results, '没有找到，换个词试试。');
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const link = document.createElement('a');
    link.className = 'search-result';
    link.href = item.url;

    const meta = document.createElement('div');
    meta.className = 'search-result__meta';

    const type = document.createElement('span');
    type.className = 'search-result__type';
    type.textContent = item.meta?.type ?? '文章';

    const date = document.createElement('span');
    date.textContent = item.meta?.date ?? '';

    meta.append(type, date);

    const title = document.createElement('h2');
    title.className = 'search-result__title';
    title.textContent = item.meta?.title ?? '未命名页面';

    const excerpt = document.createElement('p');
    excerpt.className = 'search-result__excerpt';
    excerpt.innerHTML = safeExcerpt(item.excerpt ?? '');

    link.append(meta, title, excerpt);
    fragment.append(link);
  });

  results.append(fragment);
}

function initSearch() {
  const input = document.querySelector<HTMLInputElement>('[data-search-input]');
  const results = document.querySelector<HTMLElement>('[data-search-results]');
  const hints = document.querySelector<HTMLElement>('[data-search-hints]');
  const status = document.querySelector<HTMLElement>('[data-search-status]');

  if (!input || !results || !status || input.dataset.bound === 'true') return;
  input.dataset.bound = 'true';

  const ensureIndex = async (): Promise<boolean> => {
    if (pagefind) return true;

    if (!loadPromise) {
      status.textContent = 'LOADING';
      loadPromise = (async () => {
        const path = '/pagefind/pagefind.js';
        const module = (await import(/* @vite-ignore */ path)) as PagefindModule;
        await module.options({ excerptLength: 34 });
        pagefind = module;
      })();
    }

    try {
      await loadPromise;
      status.textContent = 'READY';
      return true;
    } catch {
      status.textContent = 'NO INDEX';
      loadPromise = null;
      renderEmpty(results, '搜索索引尚未生成。本地请先运行 pnpm build，再执行 pnpm preview。');
      return false;
    }
  };

  const run = async () => {
    const keyword = input.value.trim();
    const token = ++queryToken;

    if (!keyword) {
      results.innerHTML = '';
      status.textContent = 'IDLE';
      if (hints) hints.hidden = false;
      return;
    }

    if (!(await ensureIndex())) return;
    status.textContent = 'SEARCHING';

    const search = await pagefind!.search(keyword);
    const items = await Promise.all(search.results.slice(0, 12).map((result) => result.data()));

    if (token !== queryToken) return;

    renderResults(results, items);
    status.textContent = `${items.length} RESULT`;
    if (hints) hints.hidden = items.length > 0;
  };

  input.addEventListener('focus', () => {
    void ensureIndex();
  });

  input.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      void run();
    }, 250);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      window.clearTimeout(debounceTimer);
      void run();
    }
    if (event.key === 'Escape') {
      input.value = '';
      queryToken += 1;
      results.innerHTML = '';
      status.textContent = 'IDLE';
      if (hints) hints.hidden = false;
      input.blur();
    }
  });

  document.querySelectorAll<HTMLElement>('[data-search-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.searchChip ?? '';
      window.clearTimeout(debounceTimer);
      void run();
      input.focus();
    });
  });
}

document.addEventListener('astro:page-load', initSearch);
initSearch();
