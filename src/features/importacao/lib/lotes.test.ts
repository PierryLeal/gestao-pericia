import { describe, it, expect } from 'vitest';
import { dividirEmLotes, mesclarRelatorios } from './lotes';

describe('dividirEmLotes', () => {
  it('splits into consecutive chunks of the given size', () => {
    expect(dividirEmLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when the size exceeds the item count', () => {
    expect(dividirEmLotes([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('returns an empty array for an empty input', () => {
    expect(dividirEmLotes([], 5)).toEqual([]);
  });
});

describe('mesclarRelatorios', () => {
  it('sums numeric fields and concatenates array fields', () => {
    const atual = { criados: 1, atualizados: 0, linhasComErro: [{ linhaOriginal: 2, erro: 'x' }] };
    const novo = { criados: 3, atualizados: 2, linhasComErro: [{ linhaOriginal: 9, erro: 'y' }] };

    expect(mesclarRelatorios(atual, novo)).toEqual({
      criados: 4, atualizados: 2,
      linhasComErro: [{ linhaOriginal: 2, erro: 'x' }, { linhaOriginal: 9, erro: 'y' }],
    });
  });

  it('leaves the starting report untouched when merging in an all-zero report', () => {
    const atual = { criados: 5, linhasComErro: [] as { linhaOriginal: number; erro: string }[] };
    const novo = { criados: 0, linhasComErro: [] as { linhaOriginal: number; erro: string }[] };

    expect(mesclarRelatorios(atual, novo)).toEqual({ criados: 5, linhasComErro: [] });
  });
});
