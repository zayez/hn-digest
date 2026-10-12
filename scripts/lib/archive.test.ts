import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { archiveHtmlToPaste } from './archive.ts';
import { parseIssue } from './issue-parser.ts';

const html = readFileSync(new URL('./__fixtures__/issue-806.html', import.meta.url), 'utf8');

describe('archiveHtmlToPaste', () => {
  const parsed = parseIssue(archiveHtmlToPaste(html));

  it('keeps the header the parser reads number and date from', () => {
    expect(parsed.number).toBe(806);
    expect(parsed.date).toBe('2026-08-21');
  });

  it('yields every story with its links, minus sponsor and classifieds', () => {
    expect(parsed.items).toHaveLength(55);
    expect(parsed.sections).not.toContain('Classifieds');
    expect(parsed.items[0]).toEqual({
      title: 'The Amazon tax',
      section: 'Favorites',
      domain: 'seths',
      url: 'https://seths.blog/2026/08/the-amazon-tax/',
      hnId: 49345263,
    });
    expect(parsed.items.at(-1)?.section).toBe('Fun');
  });
});
