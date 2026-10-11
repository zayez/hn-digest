import { describe, expect, it } from 'vitest';
import { slugify } from './slug.ts';

describe('slugify', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(slugify('Café: Ünïcode & “Quotes”!')).toBe('cafe-unicode-quotes');
  });

  it('keeps the HN prefix readable', () => {
    expect(slugify('Ask HN: Who is hiring? (October 2026)')).toBe(
      'ask-hn-who-is-hiring-october-2026',
    );
  });

  it('caps length without a trailing dash', () => {
    const slug = slugify('word '.repeat(30));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});
