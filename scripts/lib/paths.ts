import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const RAW_DIR = join(ROOT, 'data/raw');

export const rawPostDir = (id: number) => join(RAW_DIR, 'posts', String(id));
export const rawIssueDir = (number: number) => join(RAW_DIR, 'issues', String(number));
/** Haiku's per-story scan cards, `<hnId>.md`. */
export const scanDir = (number: number) => join(rawIssueDir(number), 'scan');
export const selectionFile = (number: number) => join(rawIssueDir(number), 'selection.json');
/** The reader's goals and tastes; private, so outside data/raw/ but gitignored too. */
export const PROFILE_FILE = join(ROOT, 'data/profile.md');

export const postFile = (id: number) => join(ROOT, 'src/content/posts', `${id}.json`);
export const issueFile = (number: number) => join(ROOT, 'src/content/issues', `${number}.json`);

/** Section for selected stories that are not in the pasted issue. */
export const EXTRA_SECTION = 'Extra';

/** Raw facts about one story, written by `ingest`, read by the summarizer and `verify`. */
export interface RawMeta {
  id: number;
  title: string;
  url?: string;
  domain?: string;
  author: string;
  postedAt: string;
  points: number;
  commentCount: number;
  threadCount: number;
  kind: 'article' | 'discussion' | 'pdf' | 'video' | 'unavailable';
  /** Ask/Tell HN body, as plain text. */
  storyText?: string;
  article?: {
    words: number;
    readingMinutes: number;
    title?: string;
    byline?: string;
    siteName?: string;
  };
  error?: string;
  fetchedAt: string;
}

export interface PlanPost {
  hnId: number;
  title: string;
  section: string;
  /** Position in the newsletter; orders posts within the issue. */
  order: number;
  newsletterTitle?: string;
  matchScore?: number;
  kind: RawMeta['kind'];
  error?: string;
}

/** What `ingest` decided for one issue; `write-issue` turns it into the issue entry. */
export interface IssuePlan {
  number: number;
  date: string;
  url?: string;
  sections: string[];
  posts: PlanPost[];
}
