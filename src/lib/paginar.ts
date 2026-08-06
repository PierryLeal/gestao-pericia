export const ITENS_POR_PAGINA_PADRAO = 30;

export function paginar<T>(itens: T[], pagina: number, tamanho: number = ITENS_POR_PAGINA_PADRAO): T[] {
  const inicio = (pagina - 1) * tamanho;
  return itens.slice(inicio, inicio + tamanho);
}

export function totalDePaginas(totalItens: number, tamanho: number = ITENS_POR_PAGINA_PADRAO): number {
  return Math.max(1, Math.ceil(totalItens / tamanho));
}
