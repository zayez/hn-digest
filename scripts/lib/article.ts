import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { extractText, getDocumentProxy } from 'unpdf';
import { decodeEntities } from './comments.ts';
import { renderPage } from './render.ts';

export type Kind = 'article' | 'discussion' | 'pdf' | 'video' | 'unavailable';

export interface ArticleResult {
  kind: Kind;
  text?: string;
  title?: string;
  byline?: string;
  siteName?: string;
  /** Why the article could not be read, when kind is 'unavailable'. */
  error?: string;
}

const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/;
/** Less than this is a cookie wall, a JS shell or a paywall teaser, not an article. */
const MIN_WORDS = 150;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

/** Fetches the HTML of a page after its scripts have run. */
export type Render = (url: string, userAgent: string) => Promise<string>;

export async function fetchArticle(
  url: string,
  render: Render = renderPage,
): Promise<ArticleResult> {
  if (VIDEO_HOSTS.test(new URL(url).hostname)) return { kind: 'video' };

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    return { kind: 'unavailable', error: `fetch failed: ${(err as Error).message}` };
  }
  if (!res.ok) return { kind: 'unavailable', error: `HTTP ${res.status}` };

  const type = res.headers.get('content-type') ?? '';
  if (type.includes('pdf') || /\.pdf($|\?)/i.test(res.url)) {
    return readPdf(new Uint8Array(await res.arrayBuffer()));
  }
  if (!type.includes('html') && !type.includes('text/plain')) {
    return { kind: 'unavailable', error: `unsupported content-type: ${type}` };
  }

  const body = await res.text();
  if (type.includes('text/plain')) {
    const result: ArticleResult = { kind: 'article', text: body };
    return isThin(result) ? unavailable(result) : result;
  }

  const result = readHtml(body);
  if (!isThin(result)) return result;
  // An empty shell is usually a page built by JavaScript: read it again once rendered.
  try {
    const rendered = readHtml(await render(res.url, USER_AGENT));
    return isThin(rendered) ? unavailable(result, 'still too thin once rendered') : rendered;
  } catch (err) {
    return unavailable(result, `rendering failed: ${(err as Error).message}`);
  }
}

const isThin = (result: ArticleResult) => !result.text || wordCount(result.text) < MIN_WORDS;

function unavailable(result: ArticleResult, note?: string): ArticleResult {
  const reason = result.text
    ? `only ${wordCount(result.text)} words extracted (paywall or JS-rendered page?)`
    : (result.error ?? 'no article text found');
  return { kind: 'unavailable', error: note ? `${reason}; ${note}` : reason };
}

export function readHtml(html: string): ArticleResult {
  let parsed: ReturnType<Readability['parse']> = null;
  try {
    // Readability mutates the document, so the fallback parses its own copy.
    parsed = new Readability(parseHTML(html).document as unknown as Document).parse();
  } catch {
    // Some bare pages (no <head>/<body>, e.g. danluu.com) crash it outright.
  }
  if (!parsed?.content) return readPlainHtml(html);
  return {
    kind: 'article',
    text: articleHtmlToText(parsed.content),
    title: parsed.title ?? undefined,
    byline: parsed.byline ?? undefined,
    siteName: parsed.siteName ?? undefined,
  };
}

/**
 * Fallback for pages Readability can't handle: the page's <main> or <article>,
 * else everything minus the site chrome. fetchArticle's MIN_WORDS check still
 * rejects whatever comes out too thin to be an article.
 */
function readPlainHtml(html: string): ArticleResult {
  const { document } = parseHTML(html);
  let root = document.querySelector('main, article');
  if (!root) {
    for (const el of document.querySelectorAll('header, nav, footer, aside')) el.remove();
    root = document.documentElement;
  }
  const text = root ? articleHtmlToText(root.innerHTML) : '';
  if (!text) return { kind: 'unavailable', error: 'no article text found' };
  // document.title is empty without a <head>, so read the element itself.
  const title = document.querySelector('title')?.textContent?.trim();
  return { kind: 'article', text, title: title || undefined };
}

async function readPdf(bytes: Uint8Array): Promise<ArticleResult> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return { kind: 'pdf', text: text.trim() };
  } catch (err) {
    return { kind: 'unavailable', error: `pdf extraction failed: ${(err as Error).message}` };
  }
}

/** Readability's cleaned HTML → plain text that keeps headings, lists and paragraphs. */
export function articleHtmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<h([1-6])[^>]*>/gi, (_, level: string) => '\n\n' + '#'.repeat(Number(level)) + ' ')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote|pre|table|tr|figure)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 230));
}
