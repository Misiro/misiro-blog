import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().max(120),
    description: z.string().max(300),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    lang: z.string().default('zh'),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z
    .object({
      date: z.coerce.date(),
      type: z.enum(['text', 'image']).default('text'),
      content: z.string(),
      image: z.string().optional(),
    })
    .refine((data) => data.type !== 'image' || Boolean(data.image), {
      message: 'type 为 image 时必须提供 image 字段',
      path: ['image'],
    }),
});

const moments = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/moments' }),
  schema: z.object({
    date: z.coerce.date(),
    content: z.string(),
    images: z
      .array(
        z.object({
          src: z.string(),
          ratio: z.enum(['4/3', '3/4', '1/1', '16/9', '9/16']).default('4/3'),
          caption: z.string().default(''),
        })
      )
      .default([]),
    video: z.string().optional(),
    address: z.string().optional(),
    from: z.string().optional(),
    link: z
      .object({
        title: z.string(),
        url: z.url(),
      })
      .optional(),
  }),
});

const albums = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/albums' }),
  schema: z.object({
    title: z.string().max(80),
    date: z.coerce.date(),
    cover: z.string(),
    description: z.string().max(200).optional(),
    photos: z
      .array(
        z.object({
          src: z.string(),
          caption: z.string().default(''),
        })
      )
      .min(1),
  }),
});

const friends = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/friends' }),
  schema: z.object({
    name: z.string(),
    url: z.url(),
    avatar: z.string().optional(),
    description: z.string(),
  }),
});

export const collections = { posts, notes, moments, albums, friends };
