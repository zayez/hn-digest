/**
 * Writes src/content/issues/<number>.json from the ingest plan, listing every
 * planned post that has been digested. Merges with an existing issue entry:
 * posts already listed stay, new ones are slotted in newsletter order.
 *
 *   npm run write-issue -- <number>
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { issueFile, postFile, rawIssueDir, type IssuePlan } from './lib/paths.ts';

interface IssueEntry {
  number: number;
  date: string;
  url?: string;
  intro?: string;
  posts: { post: string; section: string }[];
}

const number = Number(process.argv[2]);
if (!number) {
  console.error('usage: npm run write-issue -- <number>');
  process.exit(2);
}

const plan = JSON.parse(
  await readFile(join(rawIssueDir(number), 'plan.json'), 'utf8'),
) as IssuePlan;
const path = issueFile(number);
const existing = existsSync(path)
  ? (JSON.parse(await readFile(path, 'utf8')) as IssueEntry)
  : undefined;

const order = new Map(plan.posts.map((p) => [String(p.hnId), p.order]));
const refs = new Map((existing?.posts ?? []).map((ref) => [ref.post, ref]));
const missing: number[] = [];
for (const post of plan.posts) {
  if (existsSync(postFile(post.hnId))) {
    refs.set(String(post.hnId), { post: String(post.hnId), section: post.section });
  } else {
    missing.push(post.hnId);
  }
}

const entry: IssueEntry = {
  number,
  date: plan.date,
  ...((plan.url ?? existing?.url) && { url: plan.url ?? existing?.url }),
  ...(existing?.intro && { intro: existing.intro }),
  posts: [...refs.values()].sort(
    (a, b) => (order.get(a.post) ?? Infinity) - (order.get(b.post) ?? Infinity),
  ),
};

await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify(entry, null, 2) + '\n');
console.log(`Wrote ${path} with ${entry.posts.length} posts.`);
if (missing.length) console.log(`Not digested yet (left out): ${missing.join(', ')}`);
