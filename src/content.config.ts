import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const quote = z.object({
  author: z.string(),
  /** Verbatim excerpt; "…" marks an elision. Checked by `npm run verify`. */
  text: z.string().min(1),
  commentId: z.number().int(),
});

const posts = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/posts' }),
  schema: z.object({
    hnId: z.number().int(),
    title: z.string(),
    url: z.url().optional(),
    domain: z.string().optional(),
    kind: z.enum(['article', 'discussion', 'pdf', 'video', 'unavailable']),
    author: z.string(),
    postedAt: z.coerce.date(),
    points: z.number().int(),
    commentCount: z.number().int(),
    readingMinutes: z.number().int().positive().optional(),
    /** One or two sentences. Shown in listings, so it must stand alone. */
    tldr: z.string().min(1),
    article: z
      .object({
        keyPoints: z.array(z.string()).min(3).max(6),
        whyItMatters: z.string(),
      })
      .optional(),
    /** Why there is no article summary, or what it was based on (e.g. "Paywalled; summary from the HN discussion"). */
    articleNote: z.string().optional(),
    comments: z
      .object({
        overview: z.string(),
        themes: z
          .array(
            z.object({
              title: z.string(),
              synthesis: z.string(),
              quotes: z.array(quote).min(1).max(2),
            }),
          )
          .min(1)
          .max(5),
        consensus: z.string(),
        dissent: z.string(),
        contrarian: quote.extend({ why: z.string() }).optional(),
      })
      .optional(),
    digestedAt: z.coerce.date(),
  }),
});

const issues = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/issues' }),
  schema: z.object({
    number: z.number().int().positive(),
    date: z.coerce.date(),
    url: z.url().optional(),
    intro: z.string().optional(),
    posts: z.array(z.object({ post: reference('posts'), section: z.string() })),
  }),
});

export const collections = { posts, issues };
