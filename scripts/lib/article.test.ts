import { describe, expect, it } from 'vitest';
import { readHtml } from './article.ts';

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
