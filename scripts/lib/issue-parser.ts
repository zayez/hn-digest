/**
 * Parses a pasted Hacker Newsletter issue (https://hackernewsletter.com).
 *
 * Pastes usually come from an email client, so links are often lost; the parser
 * only relies on the visible text: `#Section` headers, item titles and their
 * `//domain` line. Any URLs that survive the paste (plain, `<url>`, markdown
 * `[title](url)`) are picked up as a bonus — an HN item URL makes matching exact.
 */

export interface IssueItem {
  title: string;
  section: string;
  domain?: string;
  url?: string;
  hnId?: number;
}

export interface ParsedIssue {
  number?: number;
  date?: string;
  webUrl?: string;
  sections: string[];
  items: IssueItem[];
}

/** Paid placements, not HN stories. */
const IGNORED_SECTIONS = new Set(['sponsor', 'classifieds']);
const SECTION_RE = /^#([A-Za-z][\w &'./-]*?)\s*$/;
const END_RE = /^__END__\s*$/;
// Newer issues print the domain without its TLD (`//seths`, `//platform.claude`).
const DOMAIN_RE = /(?:^|\s)\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*)(?=\s|$)/i;
const SPONSORED_RE = /^sponsored$/i;
const URL_RE = /https?:\/\/[^\s<>()[\]"']+/g;
const HN_ITEM_RE = /news\.ycombinator\.com\/item\?id=(\d+)/;

export function parseIssue(paste: string): ParsedIssue {
  const lines = paste.replace(/\r\n?/g, '\n').split('\n');
  const result: ParsedIssue = { sections: [], items: [] };

  let section: string | undefined;
  let pending: string[] | undefined; // raw lines of the item being collected

  const flush = () => {
    if (pending && section && !IGNORED_SECTIONS.has(section.toLowerCase())) {
      const item = buildItem(pending, section);
      if (item) result.items.push(item);
    }
    pending = undefined;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (END_RE.test(line)) break;

    if (!section) {
      parseHeaderLine(line, result);
    }

    const sectionMatch = SECTION_RE.exec(line);
    if (sectionMatch) {
      flush();
      section = sectionMatch[1];
      if (!IGNORED_SECTIONS.has(section.toLowerCase())) result.sections.push(section);
      continue;
    }
    if (!section || isNoise(line)) continue;

    if (SPONSORED_RE.test(line)) {
      // The marker follows the ad it labels.
      flush();
      if (result.items.at(-1)?.section === section) result.items.pop();
      continue;
    }

    if (isDomainOnly(line)) {
      // Two-line layout: title on the previous line, `//domain comments→` here.
      if (pending) pending.push(line);
      flush();
      continue;
    }

    flush();
    pending = [line];
    if (DOMAIN_RE.test(stripUrls(line))) flush(); // one-line layout
  }
  flush();

  return result;
}

function parseHeaderLine(line: string, result: ParsedIssue) {
  const number = /(?:Issue|Hacker Newsletter)\s*#(\d+)/i.exec(line);
  if (number && result.number === undefined) result.number = Number(number[1]);

  const date = /\b(\d{4}-\d{2}-\d{2})\b/.exec(line);
  if (date && result.date === undefined) result.date = date[1];

  const web = /https?:\/\/(?:mailchi\.mp|[\w.]*campaign-archive\.com)\/[^\s<>()[\]"']+/.exec(line);
  if (web && result.webUrl === undefined) result.webUrl = cleanUrl(web[0]);
}

function isNoise(line: string): boolean {
  return line === '' || line === '//' || /^comments\s*(→|->)?$/i.test(line);
}

function isDomainOnly(line: string): boolean {
  const text = stripUrls(line)
    .replace(/comments\s*(→|->)?/i, '')
    .trim();
  return /^\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*$/i.test(text);
}

function buildItem(rawLines: string[], section: string): IssueItem | undefined {
  const joined = rawLines.join(' ');
  const urls = (joined.match(URL_RE) ?? []).map(cleanUrl);

  const hnUrl = urls.find((u) => HN_ITEM_RE.test(u));
  const articleUrl = urls.find((u) => !HN_ITEM_RE.test(u));

  const text = stripUrls(joined);
  const domain = DOMAIN_RE.exec(text)?.[1]?.toLowerCase();
  const title = text
    .replace(DOMAIN_RE, ' ')
    .replace(/comments\s*(→|->)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title) return undefined;

  const item: IssueItem = { title, section };
  if (domain) item.domain = domain;
  if (articleUrl) item.url = articleUrl;
  if (hnUrl) item.hnId = Number(HN_ITEM_RE.exec(hnUrl)![1]);
  // Ask HN items link straight to the HN thread, with no separate comments link.
  if (!item.hnId && domain === 'news.ycombinator.com' && articleUrl) {
    const id = HN_ITEM_RE.exec(articleUrl);
    if (id) item.hnId = Number(id[1]);
  }
  return item;
}

/** Removes URLs and the wrappers pastes put around them, keeping markdown link text. */
function stripUrls(line: string): string {
  return line
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[<⟨(]\s*https?:\/\/[^\s>⟩)]*\s*[>⟩)]/g, ' ')
    .replace(URL_RE, ' ');
}

/** Drops the newsletter's tracking params (`utm_*`, `e=[UNIQID]`). */
export function cleanUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'e') url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return raw;
  }
}
