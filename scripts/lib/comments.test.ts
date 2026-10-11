import { describe, expect, it } from 'vitest';
import { flattenComments, htmlToText, renderComments, type AlgoliaNode } from './comments.ts';

const node = (
  id: number,
  author: string | null,
  text: string | null,
  children: AlgoliaNode[] = [],
) => ({
  id,
  author,
  text,
  children,
});

const story: AlgoliaNode = node(100, 'op', null, [
  node(1, 'alice', '<p>first</p>', [node(11, 'bob', 'reply to first')]),
  node(2, null, null, [node(21, 'carol', 'orphan reply')]), // deleted parent
  node(3, 'dave', 'third'),
]);

describe('flattenComments', () => {
  it('orders top-level threads by HN rank, depth-first within threads', () => {
    const flat = flattenComments(story, [3, 1, 2]);
    expect(flat.comments.map((c) => [c.id, c.thread, c.depth])).toEqual([
      [3, 1, 0],
      [1, 2, 0],
      [11, 2, 1],
      [21, 3, 0],
    ]);
    expect(flat.threadCount).toBe(3);
  });

  it('keeps replies to deleted comments, promoted to the deleted depth', () => {
    const flat = flattenComments(story, [1, 2, 3]);
    expect(flat.comments.find((c) => c.id === 21)).toMatchObject({ depth: 0, parentId: 2 });
  });

  it('falls back to API order when ranks are unknown', () => {
    expect(flattenComments(story).comments.map((c) => c.id)).toEqual([1, 11, 21, 3]);
  });

  it('does not count fully deleted threads', () => {
    const flat = flattenComments(node(100, 'op', null, [node(1, null, null), node(2, 'x', 'y')]));
    expect(flat.threadCount).toBe(1);
    expect(flat.comments[0].thread).toBe(1);
  });
});

describe('renderComments', () => {
  it('renders threads with headers, ids and indentation', () => {
    expect(renderComments(flattenComments(story, [1, 2, 3]))).toBe(
      [
        '=== Thread 1/3 · 2 comments ===',
        '',
        '[c:1] @alice',
        '  first',
        '',
        '  [c:11] @bob',
        '    reply to first',
        '',
        '',
        '=== Thread 2/3 · 1 comments ===',
        '',
        '[c:21] @carol',
        '  orphan reply',
        '',
        '',
        '=== Thread 3/3 · 1 comments ===',
        '',
        '[c:3] @dave',
        '  third',
        '',
      ].join('\n'),
    );
  });
});

describe('htmlToText', () => {
  it('converts paragraphs, links, italics and entities', () => {
    expect(
      htmlToText(
        'It&#x27;s <i>fine</i>.<p>See <a href="https:&#x2F;&#x2F;example.com&#x2F;a&#x2F;very&#x2F;long" rel="nofollow">https:&#x2F;&#x2F;example.com&#x2F;a...</a> &amp; <a href="https://x.y">x.y</a>',
      ),
    ).toBe("It's *fine*.\n\nSee https://example.com/a/very/long & x.y");
  });

  it('keeps code blocks', () => {
    expect(htmlToText('<pre><code>  a &lt; b\n</code></pre>')).toBe('a < b');
  });
});
