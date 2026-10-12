/**
 * Favorite posts, kept in the reader's browser: the site is static, so there
 * is no account to sync them to. Stored as post ids, most recently saved first.
 */

const KEY = 'hn-digest:favorites';
/** Fired on `document` whenever this tab changes the list. */
export const FAVORITES_CHANGE = 'favorites-change';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/** Tolerates a missing or corrupted value: anything unexpected reads as no favorites. */
export function parseFavorites(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === 'string'))] : [];
  } catch {
    return [];
  }
}

/** Adds the id at the front, or removes it if already there. */
export function toggleFavorite(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((other) => other !== id) : [id, ...ids];
}

export const loadFavorites = (storage: Storage = localStorage) =>
  parseFavorites(storage.getItem(KEY));

export function saveFavorites(ids: string[], storage: Storage = localStorage) {
  storage.setItem(KEY, JSON.stringify(ids));
  document.dispatchEvent(new CustomEvent(FAVORITES_CHANGE));
}

/** Calls `listener` now and whenever the list changes, in this tab or another. */
export function watchFavorites(listener: (ids: string[]) => void) {
  const update = () => listener(loadFavorites());
  update();
  document.addEventListener(FAVORITES_CHANGE, update);
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) update();
  });
}
