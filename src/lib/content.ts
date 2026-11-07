import { getCollection, type CollectionEntry } from 'astro:content';
import { countText, readingMinutes } from './format';

export type Post = CollectionEntry<'posts'>;
export type Note = CollectionEntry<'notes'>;
export type Moment = CollectionEntry<'moments'>;
export type Album = CollectionEntry<'albums'>;
export type Friend = CollectionEntry<'friends'>;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getNotes(): Promise<Note[]> {
  const notes = await getCollection('notes');
  return notes.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getMoments(): Promise<Moment[]> {
  const moments = await getCollection('moments');
  return moments.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getAlbums(): Promise<Album[]> {
  const albums = await getCollection('albums');
  return albums.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getFriends(): Promise<Friend[]> {
  return getCollection('friends');
}

export function readingTime(post: Post): number {
  return readingMinutes(post.body ?? '');
}

export function wordCount(posts: Post[]): number {
  return posts.reduce((total, post) => total + countText(post.body ?? ''), 0);
}

export function featuredPost(posts: Post[]): Post | undefined {
  return posts.find((post) => post.data.featured);
}

export function relatedPosts(all: Post[], current: Post, limit = 3): Post[] {
  return all
    .filter((post) => post.id !== current.id)
    .map((post) => ({
      post,
      score: post.data.tags.filter((tag) => current.data.tags.includes(tag)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.post.data.pubDate.valueOf() - a.post.data.pubDate.valueOf())
    .slice(0, limit)
    .map((entry) => entry.post);
}

export function groupByYear(posts: Post[]): { year: string; posts: Post[] }[] {
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    const year = String(post.data.pubDate.getFullYear());
    const list = groups.get(year) ?? [];
    list.push(post);
    groups.set(year, list);
  }
  return [...groups.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, list]) => ({ year, posts: list }));
}

export function tagCounts(posts: Post[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

export function categoryCounts(
  posts: Post[]
): { name: string; count: number; latest: Post }[] {
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    const list = groups.get(post.data.category) ?? [];
    list.push(post);
    groups.set(post.data.category, list);
  }
  return [...groups.entries()]
    .map(([name, list]) => ({
      name,
      count: list.length,
      latest: list[0],
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}
