import { describe, expect, it } from 'vitest';
import type { IssueItem } from './issue-parser.ts';
import type { IssuePlan, PlanPost } from './paths.ts';
import { resolveSelection, type Pick, type Selection } from './selection.ts';

const items: IssueItem[] = [
  { title: 'Composition over configuration', section: 'Code', domain: 'a.dev', hnId: 1 },
  { title: 'On friendship', section: 'Learn', domain: 'b.org', url: 'https://b.org/f', hnId: 2 },
  { title: 'A newsletter-only link', section: 'Fun', domain: 'c.io', url: 'https://c.io/' },
  { title: 'Chip news', section: 'Data', domain: 'd.com', hnId: 4 },
  { title: 'Effects in TypeScript', section: 'Code', domain: 'e.dev', hnId: 5 },
  {
    title: 'The Amazon tax',
    section: 'Fun',
    domain: 'seths',
    url: 'https://seths.blog/x',
    hnId: 6,
  },
];

const planPost = (hnId: number, section: string, order: number): PlanPost => ({
  hnId,
  title: `Story ${hnId}`,
  section,
  order,
  kind: 'article',
});

const plan: IssuePlan = {
  number: 900,
  date: '2026-10-09',
  sections: ['Code', 'Learn', 'Fun', 'Data'],
  posts: [
    planPost(1, 'Code', 0),
    planPost(2, 'Learn', 1),
    planPost(4, 'Data', 3),
    planPost(5, 'Code', 4),
  ],
};

const pick = (hnId: number, tier: Pick['tier']): Pick => ({
  hnId,
  tier,
  reason: `public ${hnId}`,
  why: `private ${hnId}`,
});

const select = (picks: Pick[], nearMisses: Selection['nearMisses'] = []): Selection => ({
  number: 900,
  picks,
  nearMisses,
});

const all = () => true;

describe('resolveSelection', () => {
  it('lists picks tier by tier, keeping rank within a tier, with sections from the plan', () => {
    const { posts, errors } = resolveSelection(
      select([pick(5, 'worthYourTime'), pick(2, 'dontSkip'), pick(1, 'worthYourTime')]),
      plan,
      items,
      all,
    );
    expect(errors).toEqual([]);
    expect(posts).toEqual([
      { post: '2', section: 'Learn', tier: 'dontSkip', reason: 'public 2' },
      { post: '5', section: 'Code', tier: 'worthYourTime', reason: 'public 5' },
      { post: '1', section: 'Code', tier: 'worthYourTime', reason: 'public 1' },
    ]);
  });

  it('never publishes the private why', () => {
    const { posts } = resolveSelection(select([pick(1, 'dontSkip')]), plan, items, all);
    expect(JSON.stringify(posts)).not.toContain('private');
  });

  it('leaves undigested picks out and reports them', () => {
    const { posts, undigested } = resolveSelection(
      select([pick(1, 'dontSkip'), pick(2, 'dontSkip')]),
      plan,
      items,
      (id) => id === 1,
    );
    expect(posts.map((p) => p.post)).toEqual(['1']);
    expect(undigested).toEqual([2]);
  });

  it('resolves near-misses by HN id or newsletter title, in newsletter order', () => {
    const { nearMisses, errors } = resolveSelection(
      select([pick(1, 'dontSkip')], [{ hnId: 4 }, { title: 'A newsletter-only link' }]),
      plan,
      items,
      all,
    );
    expect(errors).toEqual([]);
    expect(nearMisses).toEqual([
      { title: 'A newsletter-only link', section: 'Fun', domain: 'c.io', url: 'https://c.io/' },
      { title: 'Chip news', section: 'Data', domain: 'd.com', hnId: 4 },
    ]);
  });

  it('shows the real hostname, not the newsletter shorthand', () => {
    const { nearMisses } = resolveSelection(select([], [{ hnId: 6 }]), plan, items, all);
    expect(nearMisses[0].domain).toBe('seths.blog');
  });

  it('rejects caps, duplicates, unplanned picks and bad near-misses', () => {
    const { errors } = resolveSelection(
      select(
        [
          pick(1, 'dontSkip'),
          pick(2, 'dontSkip'),
          pick(4, 'dontSkip'),
          pick(5, 'dontSkip'),
          pick(5, 'worthYourTime'),
          pick(99, 'ifYouHaveAMinute'),
        ],
        [{ hnId: 1 }, { title: 'Not in the issue' }],
      ),
      plan,
      items,
      all,
    );
    expect(errors).toEqual([
      '5 is picked twice.',
      'Pick 99 is not in the ingest plan.',
      "Don't skip holds 4 posts; the cap is 3.",
      'Near-miss 1 is also a pick.',
      'Near-miss "Not in the issue" is not in the pasted issue.',
    ]);
  });
});
