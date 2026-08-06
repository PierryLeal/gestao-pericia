import { describe, it, expect, vi } from 'vitest';
import { buscarTodasAsPaginas } from './pagination';

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
