import { describe, it, expect, vi } from 'vitest';
import { buscarTodasAsPaginas, buscarPorIdsEmLotes } from './pagination';

describe('buscarTodasAsPaginas', () => {
  it('returns all rows from a single short page without a second request', async () => {
    const construirPagina = vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], error: null });

    const resultado = await buscarTodasAsPaginas(construirPagina, 1000);

    expect(resultado).toEqual([{ id: 1 }, { id: 2 }]);
    expect(construirPagina).toHaveBeenCalledTimes(1);
    expect(construirPagina).toHaveBeenCalledWith(0, 999);
  });

  it('keeps paging while a page comes back exactly full, stopping at the first short page', async () => {
    const paginaCheia = Array.from({ length: 3 }, (_, i) => ({ id: i }));
    const ultimaPagina = [{ id: 100 }];
    const construirPagina = vi
      .fn()
      .mockResolvedValueOnce({ data: paginaCheia, error: null })
      .mockResolvedValueOnce({ data: paginaCheia, error: null })
      .mockResolvedValueOnce({ data: ultimaPagina, error: null });

    const resultado = await buscarTodasAsPaginas(construirPagina, 3);

    expect(resultado).toHaveLength(7);
    expect(construirPagina).toHaveBeenCalledTimes(3);
    expect(construirPagina).toHaveBeenNthCalledWith(1, 0, 2);
    expect(construirPagina).toHaveBeenNthCalledWith(2, 3, 5);
    expect(construirPagina).toHaveBeenNthCalledWith(3, 6, 8);
  });

  it('treats a page exactly equal to the page size as possibly-more, even if it turns out to be the last page', async () => {
    const construirPagina = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const resultado = await buscarTodasAsPaginas(construirPagina, 2);

    expect(resultado).toEqual([{ id: 1 }, { id: 2 }]);
    expect(construirPagina).toHaveBeenCalledTimes(2);
  });

  it('returns an empty array when the table is empty', async () => {
    const construirPagina = vi.fn().mockResolvedValue({ data: [], error: null });
    expect(await buscarTodasAsPaginas(construirPagina)).toEqual([]);
  });

  it('treats a null data payload as an empty page', async () => {
    const construirPagina = vi.fn().mockResolvedValue({ data: null, error: null });
    expect(await buscarTodasAsPaginas(construirPagina)).toEqual([]);
  });

  it('throws with the PostgREST error message when a page errors', async () => {
    const construirPagina = vi.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(buscarTodasAsPaginas(construirPagina)).rejects.toThrow('permission denied');
  });
});

describe('buscarPorIdsEmLotes', () => {
  it('makes a single call when ids fit in one lote', async () => {
    const construirConsulta = vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], error: null });

    const resultado = await buscarPorIdsEmLotes([1, 2, 3], construirConsulta, 500);

    expect(construirConsulta).toHaveBeenCalledTimes(1);
    expect(construirConsulta).toHaveBeenCalledWith([1, 2, 3], 0, 999);
    expect(resultado).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('splits ids into multiple lotes and merges every result, avoiding one giant .in() list', async () => {
    const construirConsulta = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 'a' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'b' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'c' }], error: null });

    const ids = [1, 2, 3, 4, 5];
    const resultado = await buscarPorIdsEmLotes(ids, construirConsulta, 2);

    expect(construirConsulta).toHaveBeenCalledTimes(3);
    expect(construirConsulta).toHaveBeenNthCalledWith(1, [1, 2], 0, 999);
    expect(construirConsulta).toHaveBeenNthCalledWith(2, [3, 4], 0, 999);
    expect(construirConsulta).toHaveBeenNthCalledWith(3, [5], 0, 999);
    expect(resultado).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('paginates within a single lote when that lote alone returns a full page of result rows', async () => {
    // Row pagination here is buscarTodasAsPaginas' own default (1000) — a
    // page exactly that size must trigger a follow-up call for the same lote.
    const paginaCheia = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const construirConsulta = vi
      .fn()
      .mockResolvedValueOnce({ data: paginaCheia, error: null })
      .mockResolvedValueOnce({ data: [{ id: 1000 }], error: null });

    const resultado = await buscarPorIdsEmLotes([1, 2], construirConsulta, 500);

    expect(construirConsulta).toHaveBeenCalledTimes(2);
    expect(construirConsulta).toHaveBeenNthCalledWith(1, [1, 2], 0, 999);
    expect(construirConsulta).toHaveBeenNthCalledWith(2, [1, 2], 1000, 1999);
    expect(resultado).toHaveLength(1001);
  });

  it('returns an empty array without calling construirConsulta when ids is empty', async () => {
    const construirConsulta = vi.fn();
    const resultado = await buscarPorIdsEmLotes([], construirConsulta, 500);
    expect(resultado).toEqual([]);
    expect(construirConsulta).not.toHaveBeenCalled();
  });
});
