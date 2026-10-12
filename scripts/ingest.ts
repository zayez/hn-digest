/**
 * Ingests one newsletter issue: parses the pasted issue, fetches each HN story
 * (metadata, ranked comment tree, article text) into data/raw/, matches stories
 * to newsletter sections and writes the issue plan. `--all` takes every item in
 * the paste that has an HN thread, for scanning before anything is picked.
 *
 *   npm run ingest -- <paste-file> (--all | <hn-link-or-id>...) [--number N] [--date YYYY-MM-DD] [--refresh]
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { fetchArticle, readingMinutes, wordCount } from './lib/article.ts';
import { flattenComments, htmlToText, renderComments } from './lib/comments.ts';
import { parseIssue, type ParsedIssue } from './lib/issue-parser.ts';
import { fetchFullCommentTree, fetchStory, parseHnId } from './lib/hn.ts';
import { CONFIDENT_SCORE, domainOf, matchStory } from './lib/match.ts';
import { mapPool } from './lib/pool.ts';
import {
  EXTRA_SECTION,
  postFile,
  rawIssueDir,
  rawPostDir,
  scanDir,
  type IssuePlan,
  type PlanPost,
  type RawMeta,
} from './lib/paths.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    number: { type: 'string' },
    date: { type: 'string' },
    refresh: { type: 'boolean', default: false },
    all: { type: 'boolean', default: false },
  },
});

const [pasteFile, ...links] = positionals;
if (!pasteFile || values.all === links.length > 0) {
  console.error(
    'usage: npm run ingest -- <paste-file> (--all | <hn-link-or-id>...) [--number N] [--date YYYY-MM-DD] [--refresh]',
  );
  process.exit(2);
}

const issue = parseIssue(await readFile(pasteFile, 'utf8'));

const ids = values.all
  ? [...new Set(issue.items.flatMap((item) => item.hnId ?? []))]
  : links.map((link) => {
      const id = parseHnId(link);
      if (!id) throw new Error(`Not an HN item link or id: ${link}`);
      return id;
    });
const number = values.number ? Number(values.number) : issue.number;
const date = values.date ?? issue.date;
if (!number || !date) {
  console.error(
    `Could not read the issue ${number ? 'date' : 'number'} from the paste; pass --number / --date.`,
  );
  process.exit(2);
}

const issueDir = rawIssueDir(number);
await mkdir(issueDir, { recursive: true });
await copyFile(pasteFile, join(issueDir, 'paste.txt'));
if (values.all) await mkdir(scanDir(number), { recursive: true });

const metas = await mapPool(ids, 4, (id) => ingestStory(id, values.refresh));

const plan = mergePlan(await readPlan(issueDir), buildPlan(number, date, issue, metas));
await writeFile(join(issueDir, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');

report(plan, metas);
if (values.all) reportThreadless(issue);

// ---------------------------------------------------------------------------

async function ingestStory(id: number, refresh: boolean): Promise<RawMeta> {
  const dir = rawPostDir(id);
  const metaPath = join(dir, 'meta.json');
  if (!refresh && existsSync(metaPath)) {
    return JSON.parse(await readFile(metaPath, 'utf8')) as RawMeta;
  }
  await mkdir(dir, { recursive: true });

  const story = await fetchStory(id);
  const tree = await fetchFullCommentTree(story);
  const flat = flattenComments(tree, story.kids);
  await writeFile(join(dir, 'comments.json'), JSON.stringify(flat.comments) + '\n');
  await writeFile(join(dir, 'comments.txt'), renderComments(flat));

  const meta: RawMeta = {
    id,
    title: story.title,
    author: story.by,
    postedAt: new Date(story.time * 1000).toISOString(),
    points: story.score,
    commentCount: story.descendants ?? flat.comments.length,
    threadCount: flat.threadCount,
    kind: 'discussion',
    fetchedAt: new Date().toISOString(),
  };
  if (story.text) meta.storyText = htmlToText(story.text);

  if (story.url) {
    meta.url = story.url;
    meta.domain = domainOf(story.url);
    const article = await fetchArticle(story.url);
    meta.kind = article.kind;
    if (article.error) meta.error = article.error;
    if (article.text) {
      await writeFile(join(dir, 'article.txt'), article.text + '\n');
      meta.article = {
        words: wordCount(article.text),
        readingMinutes: readingMinutes(article.text),
        title: article.title,
        byline: article.byline,
        siteName: article.siteName,
      };
    }
  }

  await writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n');
  return meta;
}

function buildPlan(number: number, date: string, issue: ParsedIssue, metas: RawMeta[]): IssuePlan {
  const posts = metas.map((meta): PlanPost => {
    const match = matchStory(meta, issue.items);
    const confident = match && match.score >= CONFIDENT_SCORE;
    const post: PlanPost = {
      hnId: meta.id,
      title: meta.title,
      section: confident ? match.item.section : EXTRA_SECTION,
      order: confident ? issue.items.indexOf(match.item) : issue.items.length + metas.indexOf(meta),
      kind: meta.kind,
    };
    if (match) {
      post.newsletterTitle = match.item.title;
      post.matchScore = Math.round(match.score * 100) / 100;
    }
    if (meta.error) post.error = meta.error;
    return post;
  });
  return { number, date, url: issue.webUrl, sections: issue.sections, posts };
}

async function readPlan(dir: string): Promise<IssuePlan | undefined> {
  const path = join(dir, 'plan.json');
  return existsSync(path) ? (JSON.parse(await readFile(path, 'utf8')) as IssuePlan) : undefined;
}

/** Re-running an issue with more links adds to the plan instead of replacing it. */
function mergePlan(previous: IssuePlan | undefined, next: IssuePlan): IssuePlan {
  if (!previous) return next;
  const fresh = new Set(next.posts.map((p) => p.hnId));
  return {
    ...next,
    url: next.url ?? previous.url,
    posts: [...previous.posts.filter((p) => !fresh.has(p.hnId)), ...next.posts].sort(
      (a, b) => a.order - b.order,
    ),
  };
}

function report(plan: IssuePlan, metas: RawMeta[]) {
  const byId = new Map(metas.map((m) => [m.id, m]));
  console.log(
    `Issue #${plan.number} (${plan.date}) — plan: ${join(rawIssueDir(plan.number), 'plan.json')}\n`,
  );
  for (const post of plan.posts) {
    const meta = byId.get(post.hnId);
    if (!meta) continue; // from an earlier run
    const flags = [
      existsSync(postFile(post.hnId)) && 'EXISTS (skip unless redo)',
      post.section === EXTRA_SECTION &&
        (post.newsletterTitle
          ? `UNSURE MATCH: "${post.newsletterTitle}" (${post.matchScore})`
          : 'NOT IN ISSUE'),
      post.error && `ARTICLE: ${post.error}`,
    ].filter(Boolean);
    console.log(
      `${post.hnId}  [${post.section}] ${meta.title}\n` +
        `    ${meta.kind} · ${meta.points} points · ${meta.commentCount} comments in ${meta.threadCount} threads` +
        (meta.article ? ` · ${meta.article.words} words` : '') +
        (flags.length ? `\n    ⚠ ${flags.join(' · ')}` : ''),
    );
  }
}

/** Items the newsletter links without an HN thread: near-miss material only. */
function reportThreadless(issue: ParsedIssue) {
  const threadless = issue.items.filter((item) => item.hnId === undefined);
  if (!threadless.length) return;
  console.log(`\nNo HN thread (not fetched; near-miss only):`);
  for (const item of threadless) {
    console.log(`  [${item.section}] ${item.title}${item.domain ? `  //${item.domain}` : ''}`);
  }
}
