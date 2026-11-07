export const SITE = {
  name: 'MISIRO',
  title: 'MISIRO — 构建、性能与界面实验',
  tagline: '把构建当作作品。',
  description:
    'MISIRO 是一个关于构建管线、性能预算与界面实验的技术日志。纯静态、无后端、可被搜索。',
  url: 'https://misiro.pages.dev',
  author: 'MISIRO',
  startYear: 2026,
  github: 'https://github.com/misiro',
  email: 'hi@misiro.dev',
  locale: 'zh-CN',
} as const;

export const NAV = [
  { label: '文章', href: '/archives' },
  { label: '分类', href: '/categories' },
  { label: '标签', href: '/tags' },
  { label: '手记', href: '/notes' },
  { label: '即刻', href: '/moments' },
  { label: '相册', href: '/albums' },
  { label: '友链', href: '/friends' },
  { label: '关于', href: '/about' },
] as const;
