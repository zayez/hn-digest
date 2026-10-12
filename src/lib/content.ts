import { getCollection, getEntries, type CollectionEntry } from 'astro:content';
import { slugify } from './slug.ts';
import { TIERS, type Tier } from './tiers.ts';

export type Issue = CollectionEntry<'issues'>;
export type Post = CollectionEntry<'posts'>;

/** A post as it appears in an issue: its newsletter section, tier and the reason it was picked. */
export interface IssuePost {
  post: Post;
  section: string;
  tier: Tier;
  reason: string;
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
/** A root-relative path under the site's base, which Astro doesn't add to hand-written links. */
export const withBase = (path: string) => `${base}${path}`;

export const issuePath = (issue: Issue) => withBase(`/issues/${issue.data.number}/`);
export const postSlug = (post: Post) => `${post.id}-${slugify(post.data.title)}`;
export const postPath = (post: Post) => withBase(`/posts/${postSlug(post)}/`);
export const sectionSlug = (section: string) => slugify(section);
export const sectionPath = (section: string) => withBase(`/sections/${sectionSlug(section)}/`);
export const hnThreadUrl = (id: number) => `https://news.ycombinator.com/item?id=${id}`;

/** Newest first. */
export async function getIssues(): Promise<Issue[]> {
  const issues = await getCollection('issues');
  return issues.sort((a, b) => b.data.number - a.data.number);
}

/** The issue's posts in reading order: tier by tier, best first. */
export async function getIssuePosts(issue: Issue): Promise<IssuePost[]> {
  const posts = await getEntries(issue.data.posts.map((ref) => ref.post));
  return posts.map((post, i) => {
    const { section, tier, reason } = issue.data.posts[i];
    return { post, section, tier, reason };
  });
}

/** The non-empty tiers, best first, each with its posts in rank order. */
export function groupByTier(posts: IssuePost[]): { tier: Tier; posts: IssuePost[] }[] {
  return TIERS.map((tier) => ({ tier, posts: posts.filter((p) => p.tier === tier) })).filter(
    (group) => group.posts.length > 0,
  );
}

export interface Appearance {
  issue: Issue;
  section: string;
  /** Neighbors within that issue, for prev/next navigation. */
  prev?: Post;
  next?: Post;
}

/**
 * Every issue each post appears in, keyed by post id: issues that picked it
 * first, then issues where a digested post was only a near-miss (no neighbours).
 * Newest issue first within each.
 */
export async function getAppearances(): Promise<Map<string, Appearance[]>> {
  const picked = new Map<string, Appearance[]>();
  const missed = new Map<string, Appearance[]>();
  const add = (map: Map<string, Appearance[]>, id: string, appearance: Appearance) =>
    map.set(id, [...(map.get(id) ?? []), appearance]);

  for (const issue of await getIssues()) {
    const posts = await getIssuePosts(issue);
    posts.forEach(({ post, section }, i) => {
      add(picked, post.id, { issue, section, prev: posts[i - 1]?.post, next: posts[i + 1]?.post });
    });
    for (const { hnId, section } of issue.data.nearMisses) {
      if (hnId !== undefined) add(missed, String(hnId), { issue, section });
    }
  }

  const byPost = new Map(picked);
  for (const [id, list] of missed) byPost.set(id, [...(byPost.get(id) ?? []), ...list]);
  return byPost;
}
