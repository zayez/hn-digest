import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanUrl, parseIssue } from './issue-parser.ts';

const issue715 = readFileSync(new URL('./__fixtures__/issue-715.txt', import.meta.url), 'utf8');

describe('parseIssue — plain-text paste (links lost)', () => {
  const parsed = parseIssue(issue715);

  it('reads the issue number and date from the header', () => {
    expect(parsed.number).toBe(715);
    expect(parsed.date).toBe('2024-09-06');
  });

  it('lists sections in order, without the sponsor block', () => {
    expect(parsed.sections).toEqual([
      'Favorites',
      'Ask HN',
      'Show HN',
      'Code',
      'Data',
      'Design',
      'Books',
      'Working',
      'Learn',
      'Watching',
      'Startup News',
      'Fun',
    ]);
    expect(parsed.items.some((i) => i.title.includes('WorkOS'))).toBe(false);
  });

  it('parses the two-line layout (title, then //domain)', () => {
    expect(parsed.items[0]).toEqual({
      title: 'AnandTech Farewell',
      section: 'Favorites',
      domain: 'anandtech.com',
    });
  });

  it('parses the one-line layout (title //domain comments→)', () => {
    expect(parsed.items.find((i) => i.domain === 'morizbuesing.com')).toEqual({
      title: 'Greppability is an underrated code metric',
      section: 'Code',
      domain: 'morizbuesing.com',
    });
  });

  it('keeps title-only Ask HN items', () => {
    const askHn = parsed.items.filter((i) => i.section === 'Ask HN');
    expect(askHn.map((i) => i.title)).toEqual([
      'How to store and share passwords in a company?',
      'Tell HN: Burnout is bad to your brain, take care',
      'Where to find domain experts for 1:1 tutoring?',
    ]);
    expect(askHn.every((i) => i.domain === undefined)).toBe(true);
  });

  it('stops at __END__ and counts every item', () => {
    expect(parsed.items.at(-1)?.title).toBe(
      'I made a free realtime multiplayer 2D cave gem quest game',
    );
    expect(parsed.items).toHaveLength(59);
  });
});

describe('parseIssue — paste that kept its links', () => {
  it('extracts article URL and HN id from markdown links', () => {
    const parsed = parseIssue(
      [
        'Issue #800 // 2026-10-09',
        '#Code',
        '[Greppability is an underrated code metric](https://morizbuesing.com/blog/greppability/?utm_source=hackernewsletter) //morizbuesing.com [comments→](http://news.ycombinator.com/item?id=41430772&utm_term=comment)',
      ].join('\n'),
    );
    expect(parsed.number).toBe(800);
    expect(parsed.date).toBe('2026-10-09');
    expect(parsed.items).toEqual([
      {
        title: 'Greppability is an underrated code metric',
        section: 'Code',
        domain: 'morizbuesing.com',
        url: 'https://morizbuesing.com/blog/greppability/',
        hnId: 41430772,
      },
    ]);
  });

  it('extracts angle-bracket URLs from plain-text email pastes, two-line layout', () => {
    const parsed = parseIssue(
      [
        '#Favorites',
        'Founder Mode <https://paulgraham.com/foundermode.html?utm_source=hackernewsletter>',
        '//paulgraham.com comments→ <http://news.ycombinator.com/item?id=41415023&utm_term=comment>',
      ].join('\n'),
    );
    expect(parsed.items).toEqual([
      {
        title: 'Founder Mode',
        section: 'Favorites',
        domain: 'paulgraham.com',
        url: 'https://paulgraham.com/foundermode.html',
        hnId: 41415023,
      },
    ]);
  });

  it('takes the HN id from Ask HN items that link straight to the thread', () => {
    const parsed = parseIssue(
      '#Ask HN\n[How to store passwords?](https://news.ycombinator.com/item?id=41417659&utm_source=hackernewsletter)',
    );
    expect(parsed.items[0].hnId).toBe(41417659);
  });
});

describe('cleanUrl', () => {
  it('drops tracking params but keeps real ones', () => {
    expect(
      cleanUrl(
        'https://blog.spacehey.com/entry?id=1245177&utm_source=hackernewsletter&utm_term=fav',
      ),
    ).toBe('https://blog.spacehey.com/entry?id=1245177');
  });
});
