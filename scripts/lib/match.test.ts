import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseIssue } from './issue-parser.ts';
import { CONFIDENT_SCORE, matchStory } from './match.ts';

const { items } = parseIssue(
  readFileSync(new URL('./__fixtures__/issue-715.txt', import.meta.url), 'utf8'),
);

describe('matchStory', () => {
  it('matches an edited title through its domain', () => {
    const match = matchStory(
      {
        id: 41436642,
        title: 'The hidden engineering of landfills',
        url: 'https://practical.engineering/blog/2024/9/3/the-hidden-engineering-of-landfills',
      },
      items,
    );
    expect(match?.item.title).toBe('The Engineering of Landfills');
    expect(match?.score).toBeGreaterThanOrEqual(CONFIDENT_SCORE);
  });

  it('tells apart items sharing a domain (github.com) by title', () => {
    const match = matchStory(
      {
        id: 41424373,
        title: 'Show HN: Dawarich – Self-hosted alternative to Google Location History',
        url: 'https://github.com/Freika/dawarich',
      },
      items,
    );
    expect(match?.item.title).toBe('Dawarich: Self-hosted alternative to Google Location History');
    expect(match?.item.section).toBe('Show HN');
  });

  it('matches domain-less Ask HN items by title alone', () => {
    const match = matchStory(
      { id: 41417659, title: 'Ask HN: How to store and share passwords in a company?' },
      items,
    );
    expect(match?.item.section).toBe('Ask HN');
    expect(match?.score).toBeGreaterThanOrEqual(CONFIDENT_SCORE);
  });

  it('prefers an exact HN id', () => {
    const match = matchStory({ id: 7, title: 'whatever' }, [
      { title: 'Something', section: 'Code', hnId: 7 },
    ]);
    expect(match).toEqual({ item: { title: 'Something', section: 'Code', hnId: 7 }, score: 1 });
  });

  it('does not confidently match a story that is not in the issue', () => {
    const match = matchStory(
      { id: 1, title: 'Rust 2.0 released', url: 'https://blog.rust-lang.org/rust-2' },
      items,
    );
    expect(match === undefined || match.score < CONFIDENT_SCORE).toBe(true);
  });
});
