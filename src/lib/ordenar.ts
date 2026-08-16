export type DirecaoOrdenacao = 'asc' | 'desc';

export type CriterioOrdenacao<Coluna extends string> = {
  coluna: Coluna;
  direcao: DirecaoOrdenacao;
};

/**
 * Tri-state per column: clicking the arrow that's already active for that
 * column drops it back to unsorted (neither arrow highlighted); otherwise
 * the clicked column becomes the new *primary* key (prepended), demoting
 * whatever was already active to tiebreaker roles behind it — this is what
 * makes sorts "somáveis" (e.g. Contrato asc, then Data - Hora asc as a
 * tiebreaker within each contrato).
 *
 * The most-recent-click-wins order matters: if an earlier-picked column
 * happened to already be unique per row (e.g. Data - Hora, rarely repeated),
 * appending new columns behind it would leave them with no ties left to
 * break — clicking them would visibly do nothing. Promoting the new pick to
 * primary instead guarantees it always has an effect.
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
  const outros = criterios.filter((c) => c.coluna !== coluna);
  return [{ coluna, direcao }, ...outros];
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
