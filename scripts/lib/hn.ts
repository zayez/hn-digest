import type { AlgoliaNode } from './comments.ts';

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

/** The whole comment tree in one request. */
export function fetchCommentTree(id: number): Promise<AlgoliaNode> {
  return getJson<AlgoliaNode>(`https://hn.algolia.com/api/v1/items/${id}`, 60_000);
}

/** Accepts `41399872`, `item?id=41399872` or a full HN item URL. */
export function parseHnId(input: string): number | undefined {
  const id = /(?:[?&]id=)?(\d{4,})\b/.exec(input)?.[1];
  return id ? Number(id) : undefined;
}
