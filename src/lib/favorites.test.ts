import { describe, expect, it } from 'vitest';
import { parseFavorites, toggleFavorite } from './favorites.ts';

describe('parseFavorites', () => {
  it('reads a stored list', () => {
    expect(parseFavorites('["2","1"]')).toEqual(['2', '1']);
  });

  it('reads nothing stored, or anything malformed, as no favorites', () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites('not json')).toEqual([]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
  });

  it('drops non-string entries and duplicates', () => {
    expect(parseFavorites('["1",2,null,"1","3"]')).toEqual(['1', '3']);
  });
});

describe('toggleFavorite', () => {
  it('adds a new id at the front', () => {
    expect(toggleFavorite(['1'], '2')).toEqual(['2', '1']);
  });

  it('removes an id already saved', () => {
    expect(toggleFavorite(['2', '1'], '2')).toEqual(['1']);
  });
});
