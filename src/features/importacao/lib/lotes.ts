/** Splits `itens` into consecutive chunks of at most `tamanho` each. */
export function dividirEmLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

/**
 * Merges two report objects of the same shape: numeric fields are summed,
 * array fields are concatenated. Used to accumulate a confirm report across
 * several chunked calls to the same server action.
 */
export function mesclarRelatorios<T extends Record<string, unknown>>(atual: T, novo: T): T {
  const mesclado = { ...atual };
  for (const chave of Object.keys(novo) as (keyof T)[]) {
    const valorAtual = atual[chave];
    const valorNovo = novo[chave];
    if (typeof valorAtual === 'number' && typeof valorNovo === 'number') {
      mesclado[chave] = (valorAtual + valorNovo) as T[keyof T];
    } else if (Array.isArray(valorAtual) && Array.isArray(valorNovo)) {
      mesclado[chave] = [...valorAtual, ...valorNovo] as T[keyof T];
    }
  }
  return mesclado;
}
