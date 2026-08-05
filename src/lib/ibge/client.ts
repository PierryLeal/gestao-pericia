import { matchesSearch, normalizeForSearch } from '@/lib/search';

export type MunicipioIBGE = {
  id: number;
  nome: string;
  uf: string;
};

type IbgeMunicipioResponse = {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
};

let cache: MunicipioIBGE[] | null = null;

async function loadAll(): Promise<MunicipioIBGE[]> {
  if (cache) return cache;
  const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
  if (!res.ok) throw new Error('Falha ao buscar municípios');
  const data: IbgeMunicipioResponse[] = await res.json();
  cache = data.map((m) => ({
    id: m.id,
    nome: m.nome,
    uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? '',
  }));
  return cache;
}

/** Substring search capped at 20 candidates — sized for the combobox dropdown. */
export async function searchMunicipios(query: string): Promise<MunicipioIBGE[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const all = await loadAll();
  return all.filter((m) => matchesSearch(m.nome, trimmed)).slice(0, 20);
}

/**
 * Every município whose name matches `nome` exactly (accent/case-insensitive),
 * searched against the full list with no truncation.
 *
 * `searchMunicipios` caps its result at 20 for the dropdown, which means an
 * exact match can be hidden behind longer names sharing the same prefix
 * ("São José" behind dozens of "São José do ..."). Automatic resolution during
 * an import must see the whole list, so it uses this instead.
 */
export async function findMunicipiosPorNomeExato(nome: string): Promise<MunicipioIBGE[]> {
  const trimmed = nome.trim();
  if (!trimmed) return [];
  const alvo = normalizeForSearch(trimmed);
  const all = await loadAll();
  return all.filter((m) => normalizeForSearch(m.nome) === alvo);
}

export function __resetMunicipioCache() {
  cache = null;
}
