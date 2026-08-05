import { describe, it, expect } from 'vitest';
import { resolverIdPorNome } from './resolver-id';

const peritos = [
  { id: 1, nome: 'Cleber Silva' },
  { id: 2, nome: 'Ana Paula' },
];

describe('resolverIdPorNome', () => {
  it('matches a candidate from the fresh list by normalized name (case/accent-insensitive)', () => {
    expect(resolverIdPorNome(peritos, 'nome', 'cleber SILVA', new Map())).toBe(1);
    expect(resolverIdPorNome([{ id: 7, nome: 'João Peçanha' }], 'nome', 'joao pecanha', new Map())).toBe(7);
  });

  it('falls back to the in-batch map when the fresh list has no match', () => {
    const lote = new Map<string, number>([['perito novo', 60]]);
    expect(resolverIdPorNome(peritos, 'nome', 'Perito Novo', lote)).toBe(60);
  });

  it('prefers the fresh list over the in-batch map', () => {
    const lote = new Map<string, number>([['cleber silva', 99]]);
    expect(resolverIdPorNome(peritos, 'nome', 'Cleber Silva', lote)).toBe(1);
  });

  it('returns null when neither the fresh list nor the batch map matches', () => {
    expect(resolverIdPorNome(peritos, 'nome', 'Ninguém', new Map())).toBeNull();
  });

  it('returns null for a blank name', () => {
    expect(resolverIdPorNome(peritos, 'nome', '   ', new Map())).toBeNull();
  });

  it('works on a different key field, e.g. processo número', () => {
    const processos = [{ id: 9, numero: '0001234-56.2026' }];
    expect(resolverIdPorNome(processos, 'numero', '0001234-56.2026', new Map())).toBe(9);
    expect(resolverIdPorNome(processos, 'numero', '0009999-99.2026', new Map())).toBeNull();
  });
});
