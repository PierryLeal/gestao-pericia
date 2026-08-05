import { normalizeForSearch } from '@/lib/search';

/**
 * Resolves the id of a record referenced by name during a confirm action.
 *
 * Confirm actions must never trust the `*IdExistente` values the client sends
 * back with its (possibly stale, possibly hand-edited) preview rows. Instead
 * they re-resolve the name against a fresh DB read, falling back to the
 * "created in this batch" map so the same new name appearing on several rows of
 * one sheet is created once and reused rather than duplicated.
 *
 * `campoNome` is the field holding the human-readable key: `nome` for
 * peritos/colaboradores, `numero` for processos.
 */
export function resolverIdPorNome<T extends { id: number }>(
  candidatos: T[],
  campoNome: keyof T,
  nome: string,
  criadosNesteLote: Map<string, number>
): number | null {
  if (!nome.trim()) return null;
  const chave = normalizeForSearch(nome);
  const existente = candidatos.find((candidato) => normalizeForSearch(String(candidato[campoNome])) === chave);
  return existente?.id ?? criadosNesteLote.get(chave) ?? null;
}

/** The map key used by `resolverIdPorNome` for the in-batch "created" map. */
export function chaveDeLote(nome: string): string {
  return normalizeForSearch(nome);
}
