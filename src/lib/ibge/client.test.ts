import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchMunicipios, __resetMunicipioCache } from './client';

const sampleResponse = [
  { id: 3550308, nome: 'São Paulo', microrregiao: { mesorregiao: { UF: { sigla: 'SP' } } } },
  { id: 3304557, nome: 'Rio de Janeiro', microrregiao: { mesorregiao: { UF: { sigla: 'RJ' } } } },
  { id: 3106200, nome: 'Belo Horizonte', microrregiao: { mesorregiao: { UF: { sigla: 'MG' } } } },
];

describe('searchMunicipios', () => {
  beforeEach(() => {
    __resetMunicipioCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => sampleResponse }))
    );
  });

  it('returns an empty array for queries shorter than 2 characters', async () => {
    const results = await searchMunicipios('s');
    expect(results).toEqual([]);
  });

  it('filters municipios by name, case-insensitively', async () => {
    const results = await searchMunicipios('rio');
    expect(results).toEqual([{ id: 3304557, nome: 'Rio de Janeiro', uf: 'RJ' }]);
  });

  it('caches the full list after the first request', async () => {
    await searchMunicipios('paulo');
    await searchMunicipios('belo');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when the IBGE API responds with an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => [] })));
    await expect(searchMunicipios('rio')).rejects.toThrow('Falha ao buscar municípios');
  });
});
