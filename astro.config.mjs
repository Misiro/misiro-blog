// @ts-check
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// 把 Pagefind 索引挂到 astro build 里，保证任何构建命令（astro build / pnpm build）都会产出搜索索引
const pagefind = () => ({
  name: 'pagefind-index',
  hooks: {
    'astro:build:done': ({ dir, logger }) => {
      const bin = fileURLToPath(new URL('./node_modules/pagefind/lib/runner/bin.cjs', import.meta.url));
      execFileSync(process.execPath, [bin, '--site', fileURLToPath(dir)], { stdio: 'inherit' });
      logger.info('Pagefind index generated');
    },
  },
});

export default defineConfig({
  site: 'https://blog.misiro.space',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
    pagefind(),
  ],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
