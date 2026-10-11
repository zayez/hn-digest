/**
 * Checks digested posts against their raw data: fields copied from meta.json
 * must match it, and every quote must be a verbatim excerpt of the comment it
 * cites, by the right author. Exits non-zero on failure. (Shape is checked by
 * the content schema at build time.)
 *
 *   npm run verify -- [hn-id...]   (default: every post that has raw data)
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FlatComment } from './lib/comments.ts';
import { isVerbatimQuote } from './lib/quotes.ts';
import { postFile, rawPostDir, ROOT, type RawMeta } from './lib/paths.ts';

interface Quote {
  author: string;
  text: string;
  commentId: number;
}
interface PostJson {
  hnId: number;
  title: string;
  url?: string;
  domain?: string;
  author: string;
  postedAt: string;
  points: number;
  commentCount: number;
  readingMinutes?: number;
  comments?: { themes: { title: string; quotes: Quote[] }[]; contrarian?: Quote };
}

const ids = process.argv.slice(2).map(Number);
const targets = ids.length
  ? ids
  : (await readdir(join(ROOT, 'src/content/posts')))
      .filter((f) => f.endsWith('.json'))
      .map((f) => Number(f.replace('.json', '')));

let failures = 0;
let checked = 0;
for (const id of targets) {
  const commentsPath = join(rawPostDir(id), 'comments.json');
  if (!existsSync(postFile(id))) {
    console.log(`${id}: no post file`);
    failures++;
    continue;
  }
  if (!existsSync(commentsPath)) {
    console.log(`${id}: no raw comments, skipped (run ingest to verify)`);
    continue;
  }
  const post = JSON.parse(await readFile(postFile(id), 'utf8')) as PostJson;
  const comments = JSON.parse(await readFile(commentsPath, 'utf8')) as FlatComment[];
  const byId = new Map(comments.map((c) => [c.id, c]));
  const meta = JSON.parse(await readFile(join(rawPostDir(id), 'meta.json'), 'utf8')) as RawMeta;

  // readingMinutes is only pinned when ingest measured it; a pasted article sets its own.
  const copied: [string, unknown, unknown][] = [
    ['hnId', post.hnId, meta.id],
    ['title', post.title, meta.title],
    ['url', post.url, meta.url],
    ['domain', post.domain, meta.domain],
    ['author', post.author, meta.author],
    ['postedAt', Date.parse(post.postedAt), Date.parse(meta.postedAt)],
    ['points', post.points, meta.points],
    ['commentCount', post.commentCount, meta.commentCount],
    ...(meta.article
      ? [
          ['readingMinutes', post.readingMinutes, meta.article.readingMinutes] as [
            string,
            unknown,
            unknown,
          ],
        ]
      : []),
  ];
  for (const [field, actual, expected] of copied) {
    if (actual !== expected) {
      failures++;
      console.log(
        `${id} ${field}: is ${JSON.stringify(actual)}, meta.json has ${JSON.stringify(expected)}`,
      );
    }
  }

  const quotes = [
    ...(post.comments?.themes.flatMap((t) =>
      t.quotes.map((q) => ({ q, where: `theme "${t.title}"` })),
    ) ?? []),
    ...(post.comments?.contrarian ? [{ q: post.comments.contrarian, where: 'contrarian' }] : []),
  ];
  for (const { q, where } of quotes) {
    checked++;
    const source = byId.get(q.commentId);
    const problem = !source
      ? 'comment id not found'
      : source.author !== q.author
        ? `author is @${source.author}, not @${q.author}`
        : !isVerbatimQuote(q.text, source.text)
          ? 'text is not a verbatim excerpt'
          : undefined;
    if (problem) {
      failures++;
      console.log(`${id} ${where} [c:${q.commentId}]: ${problem}\n    "${q.text}"`);
    }
  }
}

console.log(
  `\nChecked metadata and ${checked} quotes in ${targets.length} posts: ${failures ? `${failures} problem(s)` : 'all good'}.`,
);
process.exit(failures ? 1 : 0);
