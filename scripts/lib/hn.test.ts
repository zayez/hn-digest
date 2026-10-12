import { describe, expect, it } from 'vitest';
import { countLive, flattenComments } from './comments.ts';
import { buildFirebaseTree, type FirebaseComment, type FirebaseStory } from './hn.ts';

const story: FirebaseStory = {
  id: 100,
  type: 'story',
  by: 'op',
  time: 0,
  title: 'A story',
  score: 1,
  descendants: 5,
  kids: [2, 1],
};

const items: Record<number, FirebaseComment> = {
  1: { id: 1, by: 'alice', text: 'first', kids: [11] },
  11: { id: 11, by: 'bob', text: 'reply to first' },
  2: { id: 2, deleted: true, kids: [21] },
  21: { id: 21, by: 'carol', text: 'orphan reply', kids: [211] },
  211: { id: 211, by: 'dave', text: 'flagged', dead: true },
};

const fetchItem = async (id: number) => items[id] ?? null;

describe('buildFirebaseTree', () => {
  it('rebuilds the whole tree in kids order', async () => {
    const tree = await buildFirebaseTree(story, fetchItem);
    expect(countLive(tree)).toBe(3);
    expect(tree.children.map((c) => c.id)).toEqual([2, 1]);
    expect(tree.children[0].children[0]).toMatchObject({ id: 21, author: 'carol', parent_id: 2 });
  });

  it('nulls deleted, dead and missing comments so flattening drops them but keeps replies', async () => {
    const tree = await buildFirebaseTree({ ...story, kids: [2, 1, 999] }, fetchItem);
    const flat = flattenComments(tree, [2, 1, 999]);
    expect(flat.comments.map((c) => [c.id, c.depth])).toEqual([
      [21, 0],
      [1, 0],
      [11, 1],
    ]);
  });
});
