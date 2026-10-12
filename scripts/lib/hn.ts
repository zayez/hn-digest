import { countLive, type AlgoliaNode } from './comments.ts';
import { mapPool } from './pool.ts';

/** Story fields from the official HN Firebase API. `kids` is in HN's display (rank) order. */
export interface FirebaseStory {
  id: number;
  type: string;
  by: string;
  time: number;
  title: string;
  url?: string;
  text?: string;
  score: number;
  descendants?: number;
  kids?: number[];
  dead?: boolean;
  deleted?: boolean;
}

export async function getJson<T>(url: string, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

export async function fetchStory(id: number): Promise<FirebaseStory> {
  const story = await getJson<FirebaseStory | null>(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
  );
  if (!story || story.deleted) throw new Error(`HN item ${id} not found`);
  if (story.type !== 'story' && story.type !== 'poll') {
    throw new Error(`HN item ${id} is a ${story.type}, not a story`);
  }
  return story;
}

/** A comment from the Firebase API. Deleted comments carry only `id` and `deleted`. */
export interface FirebaseComment {
  id: number;
  by?: string;
  text?: string;
  kids?: number[];
  dead?: boolean;
  deleted?: boolean;
}

/** The whole comment tree in one request. Algolia's copy can be missing comments; see fetchFullCommentTree. */
export function fetchCommentTree(id: number): Promise<AlgoliaNode> {
  return getJson<AlgoliaNode>(`https://hn.algolia.com/api/v1/items/${id}`, 60_000);
}

/**
 * The story's comment tree: Algolia's single-request copy when it holds every
 * live comment, otherwise rebuilt from the Firebase API, which is complete but
 * costs one request per comment. Algolia's index silently drops comments from
 * many threads (14 of 120 on story 49402491).
 */
export async function fetchFullCommentTree(story: FirebaseStory): Promise<AlgoliaNode> {
  const algolia = await fetchCommentTree(story.id);
  if (countLive(algolia) >= (story.descendants ?? 0)) return algolia;
  return buildFirebaseTree(story, (id) =>
    getJson<FirebaseComment | null>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`),
  );
}

/**
 * Builds an Algolia-shaped comment tree from Firebase items, level by level.
 * Dead, deleted and missing comments get a null author and text, so
 * flattenComments drops them and keeps their replies. Children keep Firebase's
 * `kids` order, which is HN's rank.
 */
export async function buildFirebaseTree(
  story: FirebaseStory,
  fetchItem: (id: number) => Promise<FirebaseComment | null>,
  concurrency = 16,
): Promise<AlgoliaNode> {
  const root: AlgoliaNode = { id: story.id, author: story.by, text: null, children: [] };
  let level: { parent: AlgoliaNode; id: number }[] = (story.kids ?? []).map((id) => ({
    parent: root,
    id,
  }));
  while (level.length > 0) {
    const items = await mapPool(level, concurrency, ({ id }) => fetchItem(id));
    const next: typeof level = [];
    level.forEach(({ parent, id }, i) => {
      const item = items[i];
      const alive = item && !item.dead && !item.deleted && item.by && item.text;
      const node: AlgoliaNode = {
        id,
        author: alive ? item.by! : null,
        text: alive ? item.text! : null,
        parent_id: parent.id,
        children: [],
      };
      parent.children.push(node);
      for (const kid of item?.kids ?? []) next.push({ parent: node, id: kid });
    });
    level = next;
  }
  return root;
}

/** Accepts `41399872`, `item?id=41399872` or a full HN item URL. */
export function parseHnId(input: string): number | undefined {
  const id = /(?:[?&]id=)?(\d{4,})\b/.exec(input)?.[1];
  return id ? Number(id) : undefined;
}
