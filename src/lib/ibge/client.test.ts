import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchMunicipios, findMunicipiosPorNomeExato, __resetMunicipioCache } from './client';

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

  it('still caps the candidate list at 20 for the combobox', async () => {
    stubMunicipios(muitosComPrefixo('São José', 30));
    const results = await searchMunicipios('São José');
    expect(results).toHaveLength(20);
  });
});

function uf(sigla: string) {
  return { microrregiao: { mesorregiao: { UF: { sigla } } } };
}

function muitosComPrefixo(prefixo: string, quantidade: number) {
  return Array.from({ length: quantidade }, (_, i) => ({
    id: 1000 + i,
    nome: `${prefixo} do Lugar ${i}`,
    ...uf('SP'),
  }));
}

function stubMunicipios(municipios: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => municipios })));
}

describe('findMunicipiosPorNomeExato', () => {
  beforeEach(() => {
    __resetMunicipioCache();
  });

  it('finds an exact-name match that falls outside the first 20 substring candidates', async () => {
    // "São José" is a common prefix: the exact match sorts after 30 longer names,
    // so a truncated substring search would never see it.
    stubMunicipios([...muitosComPrefixo('São José', 30), { id: 4216602, nome: 'São José', ...uf('SC') }]);

    expect(await searchMunicipios('São José')).not.toContainEqual({ id: 4216602, nome: 'São José', uf: 'SC' });
    expect(await findMunicipiosPorNomeExato('São José')).toEqual([{ id: 4216602, nome: 'São José', uf: 'SC' }]);
  });

  it('matches ignoring case and accents', async () => {
    stubMunicipios([{ id: 3106200, nome: 'Belo Horizonte', ...uf('MG') }]);
    expect(await findMunicipiosPorNomeExato('belo horizonte')).toEqual([
      { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
    ]);
  });

  it('returns every state when the name is ambiguous across UFs', async () => {
    stubMunicipios([
      { id: 1, nome: 'Bom Jesus', ...uf('RS') },
      { id: 2, nome: 'Bom Jesus', ...uf('MG') },
      { id: 3, nome: 'Bom Jesus da Lapa', ...uf('BA') },
    ]);
    expect(await findMunicipiosPorNomeExato('Bom Jesus')).toEqual([
      { id: 1, nome: 'Bom Jesus', uf: 'RS' },
      { id: 2, nome: 'Bom Jesus', uf: 'MG' },
    ]);
  });

  it('returns an empty array for a blank name', async () => {
    stubMunicipios([{ id: 1, nome: 'Bom Jesus', ...uf('RS') }]);
    expect(await findMunicipiosPorNomeExato('   ')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
