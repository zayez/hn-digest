/**
 * Downloads a Hacker Newsletter issue from the Buttondown archive and writes it
 * to data/raw/paste.txt in the same shape as a pasted issue, ready for ingest.
 *
 *   npm run fetch-issue -- <number>
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { archiveHtmlToPaste, archiveUrl } from './lib/archive.ts';
import { parseIssue } from './lib/issue-parser.ts';
import { RAW_DIR } from './lib/paths.ts';

const number = Number(process.argv[2]);
if (!number) {
  console.error('usage: npm run fetch-issue -- <number>');
  process.exit(2);
}

const url = archiveUrl(number);
const response = await fetch(url);
if (!response.ok) {
  console.error(`${url}: HTTP ${response.status}`);
  process.exit(1);
}
const paste = archiveHtmlToPaste(await response.text());
const issue = parseIssue(paste);
if (issue.number !== number) {
  console.error(`${url} parsed as issue #${issue.number ?? '?'}, not #${number}.`);
  process.exit(1);
}

const path = join(RAW_DIR, 'paste.txt');
await mkdir(dirname(path), { recursive: true });
await writeFile(path, paste + '\n');
console.log(
  `Wrote ${path}: issue #${number} (${issue.date ?? 'no date'}), ` +
    `${issue.items.length} items in ${issue.sections.length} sections.`,
);
