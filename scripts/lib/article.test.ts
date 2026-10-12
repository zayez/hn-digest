import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchArticle, readHtml } from './article.ts';

const paragraph = `<p>${'word '.repeat(80)}end, with commas, here.</p>`;

describe('readHtml', () => {
  it('falls back to <main> on a bare page that Readability cannot parse', () => {
    // danluu.com's shape: no <head> or <body>, chrome in header/nav/footer.
    const html =
      '<!DOCTYPE html><html lang=en><meta charset=utf-8><title>Bug blindness</title>' +
      '<header><strong>Bug blindness</strong> | <a href=x>Patreon</a><hr></header>' +
      `<main>${paragraph}${paragraph}</main>` +
      '<nav><a href=y>← Previous post</a></nav><footer><a href=z>RSS</a></footer>';

    const result = readHtml(html);

    expect(result.kind).toBe('article');
    expect(result.title).toBe('Bug blindness');
    expect(result.text).toContain('end, with commas, here.');
    expect(result.text).not.toMatch(/Patreon|Previous post|RSS/);
  });

  it('drops page chrome when there is no <main> or <article>', () => {
    const html =
      '<html><title>Notes</title><header>Site name</header>' +
      `${paragraph}<nav>Menu</nav><footer>Copyright</footer></html>`;

    const result = readHtml(html);

    expect(result.text).toContain('end, with commas, here.');
    expect(result.text).not.toMatch(/Site name|Menu|Copyright/);
  });
});

describe('fetchArticle', () => {
  const shell =
    '<!DOCTYPE html><html><head><title>App</title></head><body><div id=root></div></body></html>';
  const article = `<html><head><title>How I Design</title></head><body><article>${paragraph}${paragraph}</article></body></html>`;

  afterEach(() => vi.unstubAllGlobals());
  const serve = (html: string) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(html, { headers: { 'content-type': 'text/html' } })),
    );

  it('renders a page that ships as an empty JavaScript shell', async () => {
    serve(shell);
    const render = vi.fn(async () => article);

    const result = await fetchArticle('https://example.com/post', render);

    expect(render).toHaveBeenCalledOnce();
    expect(result.kind).toBe('article');
    expect(result.text).toContain('end, with commas, here.');
  });

  it('does not render a page that already has its article', async () => {
    serve(article);
    const render = vi.fn(async () => shell);

    expect((await fetchArticle('https://example.com/post', render)).kind).toBe('article');
    expect(render).not.toHaveBeenCalled();
  });

  it('stays unavailable, with the reason, when rendering fails or comes back thin', async () => {
    serve(shell);

    const failed = await fetchArticle('https://example.com/post', async () => {
      throw new Error('no Chrome');
    });
    const thin = await fetchArticle('https://example.com/post', async () => shell);

    expect(failed).toMatchObject({
      kind: 'unavailable',
      error: expect.stringMatching(/rendering failed: no Chrome/),
    });
    expect(thin).toMatchObject({
      kind: 'unavailable',
      error: expect.stringMatching(/still too thin once rendered/),
    });
  });
});
