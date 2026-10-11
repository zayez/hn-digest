/** Normalizes the differences a faithful quote may introduce: whitespace, curly quotes, dashes, emphasis markers. */
function normalize(s: string): string {
  return s
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * True if `quote` is a verbatim excerpt of `source`. An ellipsis ("…" or "...")
 * marks an elision; each fragment between ellipses must appear, in order.
 */
export function isVerbatimQuote(quote: string, source: string): boolean {
  const haystack = normalize(source);
  const fragments = quote
    .split(/…|\.\.\.|\[\.\.\.\]/)
    .map(normalize)
    .filter((f) => f.length > 0);
  if (fragments.length === 0) return false;

  let from = 0;
  for (const fragment of fragments) {
    const at = haystack.indexOf(fragment, from);
    if (at === -1) return false;
    from = at + fragment.length;
  }
  return true;
}
