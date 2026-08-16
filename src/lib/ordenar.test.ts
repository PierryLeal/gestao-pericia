import { describe, it, expect } from 'vitest';
import { alternarCriterio, ordenar } from './ordenar';

describe('alternarCriterio', () => {
  it('adds a new column as the lowest-priority criterio when none exists for it yet', () => {
    expect(alternarCriterio([], 'data', 'asc')).toEqual([{ coluna: 'data', direcao: 'asc' }]);
  });

  it('appends a second column after the first, keeping both (somáveis)', () => {
    const primeiro = alternarCriterio([], 'data', 'asc');
    const resultado = alternarCriterio(primeiro, 'contrato', 'asc');
    expect(resultado).toEqual([
      { coluna: 'data', direcao: 'asc' },
      { coluna: 'contrato', direcao: 'asc' },
    ]);
  });

  it('flips the direction in place (same position) when the other arrow is clicked', () => {
    const asc = [
      { coluna: 'data', direcao: 'asc' as const },
      { coluna: 'contrato', direcao: 'asc' as const },
    ];
    const resultado = alternarCriterio(asc, 'data', 'desc');
    expect(resultado).toEqual([
      { coluna: 'data', direcao: 'desc' },
      { coluna: 'contrato', direcao: 'asc' },
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
