let progressBound = false;

function initToc(article: HTMLElement) {
  const list = document.querySelector<HTMLElement>('[data-toc-list]');
  if (!list) return;
  if (list.dataset.bound === 'true') return;
  list.dataset.bound = 'true';

  const headings = [...article.querySelectorAll<HTMLElement>('h2, h3')];
  if (headings.length === 0) {
    const head = document.querySelector<HTMLElement>('.toc__head');
    if (head) head.textContent = 'INDEX / 无章节';
    return;
  }

  const links = new Map<string, HTMLAnchorElement>();

  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = `section-${index + 1}`;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = `toc__link${heading.tagName === 'H3' ? ' toc__link--h3' : ''}`;
    link.href = `#${heading.id}`;

    const number = document.createElement('span');
    number.className = 'toc__num';
    number.textContent = String(index + 1).padStart(2, '0');

    const label = document.createElement('span');
    label.textContent = heading.textContent ?? '';

    link.append(number, label);
    item.append(link);
    list.append(item);
    links.set(heading.id, link);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.remove('is-active'));
        links.get(entry.target.id)?.classList.add('is-active');
      });
    },
    { rootMargin: '-96px 0px -68% 0px', threshold: 0 }
  );

  headings.forEach((heading) => observer.observe(heading));
}

function initProgress() {
  if (progressBound) return;
  if (CSS.supports('animation-timeline: scroll()')) return;
  progressBound = true;

  const update = () => {
    const bar = document.querySelector<HTMLElement>('[data-progress]');
    if (!bar) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = `scaleX(${ratio})`;
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 权限被拒或非安全上下文时退回到 execCommand
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function initCodeBlocks(article: HTMLElement) {
  article.querySelectorAll<HTMLElement>('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-wrap')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-wrap';
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.append(pre);

    const code = pre.querySelector<HTMLElement>('code');
    const language =
      [...(code?.classList ?? [])]
        .find((name) => name.startsWith('language-'))
        ?.replace('language-', '') ?? 'text';

    const langLabel = document.createElement('span');
    langLabel.className = 'code-lang';
    langLabel.textContent = language;
    langLabel.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('button');
    copy.className = 'copy-btn';
    copy.type = 'button';
    copy.textContent = 'copy';
    copy.setAttribute('aria-label', '复制代码');

    wrapper.prepend(langLabel);
    wrapper.append(copy);

    copy.addEventListener('click', async () => {
      const ok = await copyText(code?.textContent ?? '');

      if (ok) {
        copy.textContent = 'COPIED';
        copy.setAttribute('aria-label', '代码已复制');
        copy.classList.add('is-copied');
        window.setTimeout(() => {
          copy.textContent = 'copy';
          copy.setAttribute('aria-label', '复制代码');
          copy.classList.remove('is-copied');
        }, 2000);
      } else {
        copy.textContent = 'FAILED';
        copy.setAttribute('aria-label', '复制失败，请手动选择');
        window.setTimeout(() => {
          copy.textContent = 'copy';
          copy.setAttribute('aria-label', '复制代码');
        }, 2000);
      }
    });
  });
}

function initRevealHeadings(article: HTMLElement) {
  const headings = [...article.querySelectorAll<HTMLElement>('h2')];
  if (headings.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    headings.forEach((heading) => heading.classList.add('is-visible'));
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
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
  );

  headings.forEach((heading) => observer.observe(heading));
}

function initPost() {
  const article = document.querySelector<HTMLElement>('[data-post-body]');
  if (!article || article.dataset.bound === 'true') return;
  article.dataset.bound = 'true';

  initToc(article);
  initCodeBlocks(article);
  initRevealHeadings(article);
  initProgress();
}

document.addEventListener('astro:page-load', initPost);
initPost();
