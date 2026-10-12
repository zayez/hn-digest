import { describe, expect, it } from 'vitest';
import { isTierOrdered, tierCapErrors } from './tiers.ts';

describe('tierCapErrors', () => {
  it('accepts tiers at their caps, and empty tiers', () => {
    expect(tierCapErrors(['dontSkip', 'dontSkip', 'dontSkip', 'ifYouHaveAMinute'])).toEqual([]);
    expect(tierCapErrors([])).toEqual([]);
  });

  it('names each tier over its cap', () => {
    expect(tierCapErrors(Array(4).fill('dontSkip'))).toEqual([
      "Don't skip holds 4 posts; the cap is 3.",
    ]);
  });
});

describe('isTierOrdered', () => {
  it('accepts tiers in rank order, with gaps', () => {
    expect(isTierOrdered(['dontSkip', 'ifYouHaveAMinute', 'ifYouHaveAMinute'])).toBe(true);
  });

  it('rejects a lower tier before a higher one', () => {
    expect(isTierOrdered(['worthYourTime', 'dontSkip'])).toBe(false);
  });
});
