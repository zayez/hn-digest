/**
 * Prints one issue's scan sheet for ranking: every newsletter item in order,
 * with its HN stats and the Haiku scan card (data/raw/issues/<n>/scan/<hnId>.md).
 * Run after `ingest --all` and the scan agents; flags items still missing a card.
 *
 *   npm run scan-sheet -- <number>
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseIssue } from './lib/issue-parser.ts';
import { postFile, rawIssueDir, rawPostDir, scanDir, type RawMeta } from './lib/paths.ts';

const number = Number(process.argv[2]);
if (!number) {
  console.error('usage: npm run scan-sheet -- <number>');
  process.exit(2);
}

const items = parseIssue(await readFile(join(rawIssueDir(number), 'paste.txt'), 'utf8')).items;
const missing: number[] = [];

for (const [i, item] of items.entries()) {
  const head = `## ${i + 1}. [${item.section}] ${item.title}${item.domain ? `  //${item.domain}` : ''}`;
  if (item.hnId === undefined) {
    console.log(`${head}\nNo HN thread: near-miss only.\n`);
    continue;
  }
  const metaPath = join(rawPostDir(item.hnId), 'meta.json');
  const meta = existsSync(metaPath)
    ? (JSON.parse(await readFile(metaPath, 'utf8')) as RawMeta)
    : undefined;
  const stats = meta
    ? `${meta.kind} · ${meta.points} points · ${meta.commentCount} comments` +
      (meta.article ? ` · ${meta.article.readingMinutes} min read` : '')
    : 'not ingested';
  const digested = existsSync(postFile(item.hnId)) ? ' · ALREADY DIGESTED' : '';
  const cardPath = join(scanDir(number), `${item.hnId}.md`);
  const card = existsSync(cardPath) ? (await readFile(cardPath, 'utf8')).trim() : 'NO CARD';
  if (!existsSync(cardPath)) missing.push(item.hnId);
  console.log(`${head}\nhnId ${item.hnId} · ${stats}${digested}\n\n${card}\n`);
}

if (missing.length) console.log(`⚠ Missing scan cards: ${missing.join(', ')}`);
