import { describe, it, expect } from 'vitest';
import { alternarCriterio, ordenar } from './ordenar';

describe('alternarCriterio', () => {
  it('adds a new column as the only (and thus primary) criterio when none exists for it yet', () => {
    expect(alternarCriterio([], 'data', 'asc')).toEqual([{ coluna: 'data', direcao: 'asc' }]);
  });

  it('promotes a newly-clicked second column to primary, demoting the first to a tiebreaker (somáveis)', () => {
    const primeiro = alternarCriterio([], 'data', 'asc');
    const resultado = alternarCriterio(primeiro, 'contrato', 'asc');
    // "contrato" was clicked last, so it leads — "data" only breaks ties
    // within equal contrato values now. If it stayed appended behind "data"
    // instead, and data-hora happened to already be unique per row, contrato
    // would never have any visible effect.
    expect(resultado).toEqual([
      { coluna: 'contrato', direcao: 'asc' },
      { coluna: 'data', direcao: 'asc' },
    ]);
  });

  it('re-promotes an existing column to primary when the other arrow is clicked (direction flip counts as a fresh click)', () => {
    const criterios = [
      { coluna: 'data', direcao: 'asc' as const },
      { coluna: 'contrato', direcao: 'asc' as const },
    ];
    const resultado = alternarCriterio(criterios, 'contrato', 'desc');
    expect(resultado).toEqual([
      { coluna: 'contrato', direcao: 'desc' },
      { coluna: 'data', direcao: 'asc' },
    ]);
  });

  it('removes the column (back to neutral) when its already-active arrow is clicked again', () => {
    const asc = [{ coluna: 'data', direcao: 'asc' as const }];
    expect(alternarCriterio(asc, 'data', 'asc')).toEqual([]);
  });

  it('removing a middle column leaves the others in their original relative order', () => {
    const criterios = [
      { coluna: 'data', direcao: 'asc' as const },
      { coluna: 'contrato', direcao: 'asc' as const },
      { coluna: 'perito', direcao: 'desc' as const },
    ];
    const resultado = alternarCriterio(criterios, 'contrato', 'asc');
    expect(resultado).toEqual([
      { coluna: 'data', direcao: 'asc' },
      { coluna: 'perito', direcao: 'desc' },
    ]);
  });
});

describe('alternarCriterio + ordenar together: click-order regression', () => {
  type Linha = { id: number; contrato: string; data: string };
  // Deliberately chosen so contrato-led and data-led orderings disagree —
  // otherwise a test could pass "by accident" without proving which column
  // actually won priority.
  const linhas: Linha[] = [
    { id: 1, contrato: 'B-CONTRATO', data: '2026-08-01' },
    { id: 2, contrato: 'A-CONTRATO', data: '2026-08-03' },
    { id: 3, contrato: 'A-CONTRATO', data: '2026-08-02' },
  ];
  const getValor = (item: Linha, coluna: 'contrato' | 'data') => item[coluna];

  it('clicking contrato after data promotes contrato to primary — its order is visibly applied', () => {
    // Reported bug: clicking "Data - Hora" then "Contrato" appeared to have
    // no effect, because data (already unique per row) left no ties for a
    // *trailing* contrato tiebreaker to ever break. Clicking contrato must
    // promote it to primary so its order always takes effect regardless of
    // what was clicked before it.
    let criterios = alternarCriterio<'contrato' | 'data'>([], 'data', 'asc');
    criterios = alternarCriterio(criterios, 'contrato', 'asc');

    const resultado = ordenar(linhas, criterios, getValor);

    // Grouped by contrato (A before B); within A, data asc breaks the tie.
    expect(resultado.map((l) => l.id)).toEqual([3, 2, 1]);
  });

  it('the reverse click order (contrato then data) makes data primary instead', () => {
    let criterios = alternarCriterio<'contrato' | 'data'>([], 'contrato', 'asc');
    criterios = alternarCriterio(criterios, 'data', 'asc');

    const resultado = ordenar(linhas, criterios, getValor);

    // data (clicked last) leads now — every row's data is distinct here, so
    // contrato's grouping never shows through, unlike the test above. This
    // is the expected trade-off: whichever column you click last wins.
    expect(resultado.map((l) => l.id)).toEqual([1, 3, 2]);
  });
});

describe('ordenar', () => {
  type Item = { id: number; nome: string | null; idade: number | null };
  const itens: Item[] = [
    { id: 1, nome: 'Bruna', idade: 30 },
    { id: 2, nome: 'Ana', idade: 30 },
    { id: 3, nome: 'Carla', idade: 20 },
    { id: 4, nome: null, idade: 25 },
  ];
  const getValor = (item: Item, coluna: 'nome' | 'idade') => item[coluna];

  it('returns the items unchanged (same order) when there are no criterios', () => {
    expect(ordenar(itens, [], getValor)).toEqual(itens);
  });

  it('sorts by a single numeric column ascending', () => {
    const resultado = ordenar(itens, [{ coluna: 'idade', direcao: 'asc' }], getValor);
    expect(resultado.map((i) => i.id)).toEqual([3, 4, 1, 2]);
  });

  it('sorts by a single numeric column descending', () => {
    const resultado = ordenar(itens, [{ coluna: 'idade', direcao: 'desc' }], getValor);
    expect(resultado.map((i) => i.id)).toEqual([1, 2, 4, 3]);
  });

  it('sorts a string column accent/case-insensitively (pt-BR)', () => {
    const comAcento: Item[] = [
      { id: 1, nome: 'ávila', idade: 1 },
      { id: 2, nome: 'Azevedo', idade: 1 },
      { id: 3, nome: 'Bruno', idade: 1 },
    ];
    const resultado = ordenar(comAcento, [{ coluna: 'nome', direcao: 'asc' }], getValor);
    expect(resultado.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('combines two criterios: primary column first, second column breaks ties', () => {
    const resultado = ordenar(
      itens,
      [
        { coluna: 'idade', direcao: 'asc' },
        { coluna: 'nome', direcao: 'asc' },
      ],
      getValor
    );
    // idade 20 (Carla), 25 (null-nome), 30/30 tie broken by nome asc (Ana, Bruna)
    expect(resultado.map((i) => i.id)).toEqual([3, 4, 2, 1]);
  });

  it('sorts null values last regardless of direction', () => {
    const asc = ordenar(itens, [{ coluna: 'nome', direcao: 'asc' }], getValor);
    expect(asc[asc.length - 1].id).toBe(4);
    const desc = ordenar(itens, [{ coluna: 'nome', direcao: 'desc' }], getValor);
    expect(desc[desc.length - 1].id).toBe(4);
  });

  it('does not mutate the original array', () => {
    const copia = [...itens];
    ordenar(itens, [{ coluna: 'idade', direcao: 'asc' }], getValor);
    expect(itens).toEqual(copia);
  });
});
