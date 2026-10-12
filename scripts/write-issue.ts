/**
 * Writes src/content/issues/<number>.json from the reader's selection
 * (data/raw/issues/<n>/selection.json), the ingest plan and the saved paste.
 * Picks become tiered posts; picks not digested yet are left out and reported.
 *
 *   npm run write-issue -- <number>
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseIssue } from './lib/issue-parser.ts';
import { issueFile, postFile, rawIssueDir, selectionFile, type IssuePlan } from './lib/paths.ts';
import {
  resolveSelection,
  type IssuePostRef,
  type NearMiss,
  type Selection,
} from './lib/selection.ts';

interface IssueEntry {
  number: number;
  date: string;
  url?: string;
  intro?: string;
  posts: IssuePostRef[];
  nearMisses: NearMiss[];
}

const number = Number(process.argv[2]);
if (!number) {
  console.error('usage: npm run write-issue -- <number>');
  process.exit(2);
}

const dir = rawIssueDir(number);
const readJson = async <T>(path: string) => JSON.parse(await readFile(path, 'utf8')) as T;
const plan = await readJson<IssuePlan>(join(dir, 'plan.json'));
const selection = await readJson<Selection>(selectionFile(number));
const items = parseIssue(await readFile(join(dir, 'paste.txt'), 'utf8')).items;
const path = issueFile(number);
const existing = existsSync(path) ? await readJson<IssueEntry>(path) : undefined;

const { posts, nearMisses, undigested, errors } = resolveSelection(selection, plan, items, (id) =>
  existsSync(postFile(id)),
);
if (errors.length) {
  console.error(`selection.json has problems:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const entry: IssueEntry = {
  number,
  date: plan.date,
  ...((plan.url ?? existing?.url) && { url: plan.url ?? existing?.url }),
  ...(existing?.intro && { intro: existing.intro }),
  posts,
  nearMisses,
};

await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify(entry, null, 2) + '\n');
console.log(`Wrote ${path} with ${posts.length} posts and ${nearMisses.length} near-misses.`);
if (undigested.length) console.log(`Not digested yet (left out): ${undigested.join(', ')}`);
