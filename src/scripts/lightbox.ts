interface LightboxState {
  root: HTMLElement;
  img: HTMLImageElement;
  caption: HTMLElement;
  counter: HTMLElement;
  thumbs: HTMLButtonElement[];
  index: number;
  lastFocus: HTMLElement | null;
  close: () => void;
  next: () => void;
  prev: () => void;
}

let state: LightboxState | null = null;

function initLightbox() {
  const root = document.querySelector<HTMLElement>('[data-lightbox]');
  const grid = document.querySelector<HTMLElement>('[data-photo-grid]');
  if (!root || !grid || root.dataset.bound === 'true') return;

  const img = root.querySelector<HTMLImageElement>('[data-lightbox-img]');
  const caption = root.querySelector<HTMLElement>('[data-lightbox-caption]');
  const counter = root.querySelector<HTMLElement>('[data-lightbox-count]');
  if (!img || !caption || !counter) return;

  root.dataset.bound = 'true';
  const thumbs = [...grid.querySelectorAll<HTMLButtonElement>('button[data-src]')];
  if (thumbs.length === 0) return;

  let index = 0;
  let lastFocus: HTMLElement | null = null;

  const show = async (nextIndex: number, fromThumb?: HTMLElement) => {
    index = ((nextIndex % thumbs.length) + thumbs.length) % thumbs.length;
    const thumb = thumbs[index];
    const src = thumb.dataset.src ?? '';
    const text = thumb.dataset.caption ?? '';

    img.src = src;
    img.alt = text;
    caption.textContent = text;
    counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(thumbs.length).padStart(2, '0')}`;

    try {
      await img.decode();
    } catch {
      /* 图片解码失败时保留原有尺寸，不影响翻页 */
    }

    if (!fromThumb) {
      img.animate([{ opacity: 0.4 }, { opacity: 1 }], {
        duration: 120,
        easing: 'ease-out',
      });
      return;
    }

    const thumbRect = fromThumb.getBoundingClientRect();
    const imageRect = img.getBoundingClientRect();
    if (!imageRect.width || !imageRect.height) return;

    const scale = Math.max(0.08, thumbRect.width / imageRect.width);
    const dx = thumbRect.left + thumbRect.width / 2 - (imageRect.left + imageRect.width / 2);
    const dy = thumbRect.top + thumbRect.height / 2 - (imageRect.top + imageRect.height / 2);

    img.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.65 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
  };

  const open = (targetIndex: number, thumb: HTMLButtonElement) => {
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.hidden = false;
    document.body.classList.add('is-locked');
    root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' });
    void show(targetIndex, thumb);
    root.querySelector<HTMLElement>('[data-lightbox-close]')?.focus();
  };

  const close = () => {
    if (root.hidden) return;

    const imageRect = img.getBoundingClientRect();
    const thumbRect = thumbs[index].getBoundingClientRect();

    if (imageRect.width && thumbRect.width) {
      const scale = Math.max(0.08, thumbRect.width / imageRect.width);
      const dx = thumbRect.left + thumbRect.width / 2 - (imageRect.left + imageRect.width / 2);
      const dy = thumbRect.top + thumbRect.height / 2 - (imageRect.top + imageRect.height / 2);

      img.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.3 },
        ],
        { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    }

    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' });

    window.setTimeout(() => {
      root.hidden = true;
      img.src = '';
      document.body.classList.remove('is-locked');
      lastFocus?.focus();
    }, 200);
  };

  const next = () => void show(index + 1);
  const prev = () => void show(index - 1);

  grid.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-src]');
    if (!target) return;
    open(thumbs.indexOf(target), target);
  });

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-lightbox-close]')) close();
    else if (target.closest('[data-lightbox-next]')) next();
    else if (target.closest('[data-lightbox-prev]')) prev();
  });

  state = { root, img, caption, counter, thumbs, index, lastFocus, close, next, prev };
}

function trapFocus(event: KeyboardEvent, root: HTMLElement) {
  const focusable = [...root.querySelectorAll<HTMLElement>('button')].filter(
    (button) => !button.hasAttribute('disabled')
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

document.addEventListener('keydown', (event) => {
  if (!state || state.root.hidden || !state.root.isConnected) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    state.close();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    state.next();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    state.prev();
  } else if (event.key === 'Tab') {
    trapFocus(event, state.root);
  }
});

document.addEventListener('astro:page-load', initLightbox);
initLightbox();
