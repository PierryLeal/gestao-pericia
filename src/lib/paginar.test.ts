import { describe, it, expect } from 'vitest';
import { paginar, totalDePaginas } from './paginar';

describe('paginar', () => {
  const itens = Array.from({ length: 25 }, (_, i) => i + 1);

  it('returns the first page by default size', () => {
    expect(paginar(itens, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('returns the last, partial page', () => {
    expect(paginar(itens, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });

  it('returns an empty array past the last page', () => {
    expect(paginar(itens, 5, 10)).toEqual([]);
  });

  it('returns everything on one page when tamanho exceeds the item count', () => {
    expect(paginar([1, 2], 1, 30)).toEqual([1, 2]);
  });
});

describe('totalDePaginas', () => {
  it('rounds up for a partial last page', () => {
    expect(totalDePaginas(25, 10)).toBe(3);
  });

  it('returns 1 for an empty or under-one-page list, never 0', () => {
    expect(totalDePaginas(0, 10)).toBe(1);
    expect(totalDePaginas(5, 10)).toBe(1);
  });

  it('divides evenly when the count is an exact multiple', () => {
    expect(totalDePaginas(30, 10)).toBe(3);
  });
});
