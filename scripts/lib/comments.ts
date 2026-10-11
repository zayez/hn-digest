/** Shape of a node from the HN Algolia API (`/api/v1/items/<id>`). */
export interface AlgoliaNode {
  id: number;
  author: string | null;
  text: string | null;
  created_at?: string;
  parent_id?: number | null;
  children: AlgoliaNode[];
}

export interface FlatComment {
  id: number;
  parentId: number;
  author: string;
  depth: number;
  /** 1-based index of the top-level thread, in HN rank order. */
  thread: number;
  text: string;
}

export interface FlattenedThread {
  comments: FlatComment[];
  threadCount: number;
}

/**
 * Flattens the comment tree depth-first. Top-level threads follow `rankedKids`
 * (Firebase `kids`, which is HN's display order); Algolia's own order is not
 * ranked. Deleted/dead comments are dropped, but their replies are kept.
 */
export function flattenComments(story: AlgoliaNode, rankedKids: number[] = []): FlattenedThread {
  const rank = new Map(rankedKids.map((id, i) => [id, i]));
  const topLevel = [...story.children].sort(
    (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
  );

  const comments: FlatComment[] = [];
  let thread = 0;

  const walk = (node: AlgoliaNode, parentId: number, depth: number) => {
    const alive = node.author !== null && node.text !== null && node.text.trim() !== '';
    if (alive) {
      comments.push({
        id: node.id,
        parentId,
        author: node.author!,
        depth,
        thread,
        text: htmlToText(node.text!),
      });
    }
    for (const child of node.children) walk(child, node.id, alive ? depth + 1 : depth);
  };

  for (const node of topLevel) {
    const before = comments.length;
    thread++;
    walk(node, story.id, 0);
    if (comments.length === before) thread--; // fully deleted thread
  }

  return { comments, threadCount: thread };
}

/** Renders flattened comments as indented plain text, one block per comment, for reading in chunks. */
export function renderComments(flat: FlattenedThread): string {
  const replies = new Map<number, number>();
  for (const c of flat.comments) replies.set(c.thread, (replies.get(c.thread) ?? 0) + 1);

  const out: string[] = [];
  let currentThread = 0;
  for (const c of flat.comments) {
    if (c.thread !== currentThread) {
      currentThread = c.thread;
      out.push(
        `\n=== Thread ${c.thread}/${flat.threadCount} · ${replies.get(c.thread)} comments ===\n`,
      );
    }
    const indent = '  '.repeat(c.depth);
    out.push(`${indent}[c:${c.id}] @${c.author}`);
    out.push(...c.text.split('\n').map((l) => (l ? indent + '  ' + l : '')));
    out.push('');
  }
  return out.join('\n').trim() + '\n';
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Converts HN comment HTML (`<p>`, `<a>`, `<i>`, `<pre><code>`) to plain text. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<p>/gi, '\n\n')
      .replace(/<\/p>/gi, '')
      .replace(/<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_, href: string, label: string) =>
        // HN truncates long link labels with "..."; the href is the real thing.
        label.endsWith('...') ? href : label,
      )
      .replace(/<i>(.*?)<\/i>/gi, '*$1*')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
