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

export async function searchMunicipios(query: string): Promise<MunicipioIBGE[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const all = await loadAll();
  const normalized = trimmed.toLowerCase();
  return all.filter((m) => m.nome.toLowerCase().includes(normalized)).slice(0, 20);
}

export function __resetMunicipioCache() {
  cache = null;
}
