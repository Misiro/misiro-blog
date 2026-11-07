const DATE_FMT = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Shanghai',
});

const CLOCK_FMT = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
});

const DAY_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  timeZone: 'Asia/Shanghai',
});

const MONTH_FMT = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Shanghai',
});

export function formatDate(date: Date): string {
  const parts = DATE_FMT.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')}`;
}

export function formatClock(date: Date): string {
  return CLOCK_FMT.format(date);
}

export function formatStamp(date: Date): string {
  return `${formatDate(date)} ${formatClock(date)}`;
}

export function formatDay(date: Date): string {
  return DAY_FMT.format(date);
}

export function formatMonth(date: Date): string {
  return MONTH_FMT.format(date).toUpperCase();
}

export function isoDate(date: Date): string {
  return date.toISOString();
}

export function padNumber(value: number, length = 3): string {
  return String(value).padStart(length, '0');
}

export function countText(body: string): number {
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~\-|]/g, ' ');
  const cjk = (plain.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const words = (plain.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return cjk + words;
}

export function readingMinutes(body: string): number {
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~\-|]/g, ' ');
  const cjk = (plain.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const words = (plain.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.ceil(cjk / 350 + words / 200));
}

export function formatCompact(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}
