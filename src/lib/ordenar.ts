export type DirecaoOrdenacao = 'asc' | 'desc';

export type CriterioOrdenacao<Coluna extends string> = {
  coluna: Coluna;
  direcao: DirecaoOrdenacao;
};

/**
 * Tri-state per column: clicking the arrow that's already active for that
 * column drops it back to unsorted (neither arrow highlighted); clicking the
 * other arrow flips its direction in place, keeping its priority; clicking a
 * column with no criterio yet appends it as the lowest-priority tiebreaker —
 * this is what makes sorts "somáveis" (e.g. Data - Hora asc, then Contrato
 * asc as a tiebreaker) instead of one column replacing the last.
 */
export function alternarCriterio<Coluna extends string>(
  criterios: CriterioOrdenacao<Coluna>[],
  coluna: Coluna,
  direcao: DirecaoOrdenacao
): CriterioOrdenacao<Coluna>[] {
  const existente = criterios.find((c) => c.coluna === coluna);
  if (existente?.direcao === direcao) {
    return criterios.filter((c) => c.coluna !== coluna);
  }
  if (existente) {
    return criterios.map((c) => (c.coluna === coluna ? { ...c, direcao } : c));
  }
  return [...criterios, { coluna, direcao }];
}

/**
 * Sorts by each criterio in priority order, only consulting the next one to
 * break a tie — a stable multi-column sort. A null value (data not filled
 * in) always sorts last, regardless of direction, rather than jumping to the
 * front under "desc".
 */
export function ordenar<T, Coluna extends string>(
  itens: T[],
  criterios: CriterioOrdenacao<Coluna>[],
  getValor: (item: T, coluna: Coluna) => string | number | null
): T[] {
  if (criterios.length === 0) return itens;
  return [...itens].sort((a, b) => {
    for (const { coluna, direcao } of criterios) {
      const va = getValor(a, coluna);
      const vb = getValor(b, coluna);
      if (va === null && vb === null) continue;
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
      if (cmp !== 0) return direcao === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}
