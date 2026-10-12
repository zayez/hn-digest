/**
 * The reader's picks for one issue, written by Claude after ranking the scan
 * cards against data/profile.md (see the digest skill). `write-issue` turns it,
 * with the ingest plan and the parsed paste, into the issue entry.
 */
import { NEAR_MISS_CAP, TIERS, tierCapErrors, type Tier } from '../../src/lib/tiers.ts';
import type { IssueItem } from './issue-parser.ts';
import { domainOf } from './match.ts';
import type { IssuePlan } from './paths.ts';

export interface Pick {
  hnId: number;
  tier: Tier;
  /** Public: shown on the site, so it never mentions the reader's goals. */
  reason: string;
  /** Private: why it fits the reader. Stays in data/raw/. */
  why: string;
  /** A great read outside the profile. */
  wildcard?: boolean;
}

/** A newsletter item, by HN id or (for items without an HN thread) by its newsletter title. */
export type ItemRef = { hnId: number } | { title: string };

export interface Selection {
  number: number;
  /** Best first. */
  picks: Pick[];
  nearMisses: ItemRef[];
}

export interface IssuePostRef {
  post: string;
  section: string;
  tier: Tier;
  reason: string;
}

export interface NearMiss {
  title: string;
  section: string;
  domain?: string;
  url?: string;
  hnId?: number;
}

export interface ResolvedSelection {
  posts: IssuePostRef[];
  nearMisses: NearMiss[];
  /** Picks without a post JSON yet; left out of the issue. */
  undigested: number[];
  /** Problems that make the selection unusable. */
  errors: string[];
}

export function resolveSelection(
  selection: Selection,
  plan: IssuePlan,
  items: IssueItem[],
  isDigested: (hnId: number) => boolean,
): ResolvedSelection {
  const errors: string[] = [];
  const planned = new Map(plan.posts.map((p) => [p.hnId, p]));

  const seen = new Set<number>();
  for (const pick of selection.picks) {
    if (seen.has(pick.hnId)) errors.push(`${pick.hnId} is picked twice.`);
    seen.add(pick.hnId);
    if (!planned.has(pick.hnId)) errors.push(`Pick ${pick.hnId} is not in the ingest plan.`);
    if (!TIERS.includes(pick.tier))
      errors.push(`Pick ${pick.hnId} has unknown tier "${pick.tier}".`);
  }
  errors.push(...tierCapErrors(selection.picks.map((p) => p.tier)));

  // Stable sort: rank order holds within each tier.
  const ranked = [...selection.picks].sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
  const undigested = ranked.filter((p) => !isDigested(p.hnId)).map((p) => p.hnId);
  const posts = ranked
    .filter((p) => isDigested(p.hnId) && planned.has(p.hnId))
    .map((p) => ({
      post: String(p.hnId),
      section: planned.get(p.hnId)!.section,
      tier: p.tier,
      reason: p.reason,
    }));

  if (selection.nearMisses.length > NEAR_MISS_CAP) {
    errors.push(`${selection.nearMisses.length} near-misses; the cap is ${NEAR_MISS_CAP}.`);
  }
  const nearMisses: NearMiss[] = [];
  for (const ref of selection.nearMisses) {
    const item =
      'hnId' in ref
        ? items.find((i) => i.hnId === ref.hnId)
        : items.find((i) => i.title === ref.title);
    const label = 'hnId' in ref ? String(ref.hnId) : `"${ref.title}"`;
    if (!item) {
      errors.push(`Near-miss ${label} is not in the pasted issue.`);
      continue;
    }
    if (item.hnId !== undefined && seen.has(item.hnId)) {
      errors.push(`Near-miss ${label} is also a pick.`);
      continue;
    }
    // The newsletter shortens domains (`//seths`); the URL has the real one.
    const domain = item.url ? domainOf(item.url) : item.domain;
    nearMisses.push({
      title: item.title,
      section: item.section,
      ...(domain && { domain }),
      ...(item.url && { url: item.url }),
      ...(item.hnId !== undefined && { hnId: item.hnId }),
    });
  }
  // Newsletter order, so the list reads like a skim of the issue.
  nearMisses.sort((a, b) => indexOf(items, a) - indexOf(items, b));

  return { posts, nearMisses, undigested, errors };
}

function indexOf(items: IssueItem[], miss: NearMiss): number {
  return items.findIndex((i) =>
    miss.hnId !== undefined ? i.hnId === miss.hnId : i.title === miss.title,
  );
}
