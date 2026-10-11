import type { IssueItem } from './issue-parser.ts';

export interface HnStory {
  id: number;
  title: string;
  url?: string;
}

export interface Match {
  item: IssueItem;
  /** 1 = exact HN id match; otherwise a domain + title similarity score in [0, 1). */
  score: number;
}

/** Below this, a match is reported as a guess for a human (or Claude) to confirm. */
export const CONFIDENT_SCORE = 0.5;

/**
 * Finds the newsletter item a selected HN story came from. Newsletter titles are
 * often edited ("The hidden engineering of landfills" → "The Engineering of
 * Landfills"), so the domain carries most of the weight when there is no id.
 */
export function matchStory(story: HnStory, items: IssueItem[]): Match | undefined {
  const exact = items.find((item) => item.hnId === story.id);
  if (exact) return { item: exact, score: 1 };

  const storyDomain = story.url ? domainOf(story.url) : 'news.ycombinator.com';
  let best: Match | undefined;
  for (const item of items) {
    const sameDomain = item.domain !== undefined && sameSite(item.domain, storyDomain);
    const similarity = titleSimilarity(item.title, story.title);
    // Same domain needs only a little title overlap; a title alone must be close.
    const score = sameDomain ? 0.4 + similarity * 0.59 : similarity * 0.9;
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score > 0.15 ? best : undefined;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function sameSite(a: string, b: string): boolean {
  const strip = (d: string) => d.replace(/^www\./, '').toLowerCase();
  return strip(a) === strip(b);
}

const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'is']);

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/^(show|ask|tell|launch) hn:\s*/, '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !STOPWORDS.has(t)),
  );
}

/** Share of the newsletter title's words found in the HN title (titles get shortened, not padded). */
export function titleSimilarity(newsletterTitle: string, hnTitle: string): number {
  const a = tokens(newsletterTitle);
  const b = tokens(hnTitle);
  if (a.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.max(a.size, Math.min(b.size, a.size + 2));
}
