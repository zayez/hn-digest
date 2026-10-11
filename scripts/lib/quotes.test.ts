import { describe, expect, it } from 'vitest';
import { isVerbatimQuote } from './quotes.ts';

const source = `I've used it for years.

The “real” problem is — as always — the build system, not the language.`;

describe('isVerbatimQuote', () => {
  it('accepts an exact excerpt despite whitespace and typographic differences', () => {
    expect(isVerbatimQuote(`The "real" problem is - as always - the build system`, source)).toBe(
      true,
    );
  });

  it('accepts elisions in order', () => {
    expect(isVerbatimQuote("I've used it … the build system", source)).toBe(true);
  });

  it('rejects paraphrases and out-of-order fragments', () => {
    expect(isVerbatimQuote('The real issue is the build system', source)).toBe(false);
    expect(isVerbatimQuote("the build system … I've used it", source)).toBe(false);
  });

  it('rejects an empty quote', () => {
    expect(isVerbatimQuote('…', source)).toBe(false);
  });
});
