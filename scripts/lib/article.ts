import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { extractText, getDocumentProxy } from 'unpdf';
import { decodeEntities } from './comments.ts';

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

export async function fetchArticle(url: string): Promise<ArticleResult> {
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
  const result = type.includes('text/plain')
    ? { kind: 'article' as const, text: body }
    : readHtml(body);
  if (result.text && wordCount(result.text) < MIN_WORDS) {
    return {
      kind: 'unavailable',
      error: `only ${wordCount(result.text)} words extracted (paywall or JS-rendered page?)`,
    };
  }
  return result;
}

function readHtml(html: string): ArticleResult {
  const { document } = parseHTML(html);
  const parsed = new Readability(document as unknown as Document).parse();
  if (!parsed?.content) return { kind: 'unavailable', error: 'readability found no article' };
  return {
    kind: 'article',
    text: articleHtmlToText(parsed.content),
    title: parsed.title ?? undefined,
    byline: parsed.byline ?? undefined,
    siteName: parsed.siteName ?? undefined,
  };
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
