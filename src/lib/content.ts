import { getCollection, getEntries, type CollectionEntry } from 'astro:content';
import { slugify } from './slug.ts';

export type Issue = CollectionEntry<'issues'>;
export type Post = CollectionEntry<'posts'>;

/** A post as it appears in an issue: the newsletter section travels with it. */
export interface IssuePost {
  post: Post;
  section: string;
}

export const issuePath = (issue: Issue) => `/issues/${issue.data.number}/`;
export const postSlug = (post: Post) => `${post.id}-${slugify(post.data.title)}`;
export const postPath = (post: Post) => `/posts/${postSlug(post)}/`;
export const sectionSlug = (section: string) => slugify(section);
export const sectionPath = (section: string) => `/sections/${sectionSlug(section)}/`;
export const hnThreadUrl = (id: number) => `https://news.ycombinator.com/item?id=${id}`;

/** Newest first. */
export async function getIssues(): Promise<Issue[]> {
  const issues = await getCollection('issues');
  return issues.sort((a, b) => b.data.number - a.data.number);
}

/** The issue's posts in newsletter order. */
export async function getIssuePosts(issue: Issue): Promise<IssuePost[]> {
  const posts = await getEntries(issue.data.posts.map((ref) => ref.post));
  return posts.map((post, i) => ({ post, section: issue.data.posts[i].section }));
}

/** Consecutive runs of posts sharing a section, in order. */
export function groupBySection(posts: IssuePost[]): { section: string; posts: Post[] }[] {
  const groups: { section: string; posts: Post[] }[] = [];
  for (const { post, section } of posts) {
    const last = groups.at(-1);
    if (last?.section === section) last.posts.push(post);
    else groups.push({ section, posts: [post] });
  }
  return groups;
}

export interface Appearance {
  issue: Issue;
  section: string;
  /** Neighbors within that issue, for prev/next navigation. */
  prev?: Post;
  next?: Post;
}

/** Every issue each post appears in, newest issue first, keyed by post id. */
export async function getAppearances(): Promise<Map<string, Appearance[]>> {
  const byPost = new Map<string, Appearance[]>();
  for (const issue of await getIssues()) {
    const posts = await getIssuePosts(issue);
    posts.forEach(({ post, section }, i) => {
      const list = byPost.get(post.id) ?? [];
      list.push({ issue, section, prev: posts[i - 1]?.post, next: posts[i + 1]?.post });
      byPost.set(post.id, list);
    });
  }
  return byPost;
}
