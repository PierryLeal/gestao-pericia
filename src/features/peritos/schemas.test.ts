import { describe, it, expect } from 'vitest';
import { peritoSchema } from './schemas';

describe('peritoSchema', () => {
  it('accepts a valid perito', () => {
    const result = peritoSchema.safeParse({
      nome: 'João Silva',
      contato: '(11) 99999-0000',
      formacao: 'Engenharia Civil',
      crea: '123456',
      documento: '111.111.111-11',
      jaTrabalhamos: true,
      relacao: 8,
      resultados: 9,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty nome', () => {
    const result = peritoSchema.safeParse({ nome: '' });
    expect(result.success).toBe(false);
  });

  it('rejects relacao above 10', () => {
    const result = peritoSchema.safeParse({ nome: 'X', relacao: 11 });
    expect(result.success).toBe(false);
  });

  it('rejects resultados below 0', () => {
    const result = peritoSchema.safeParse({ nome: 'X', resultados: -1 });
    expect(result.success).toBe(false);
  });
});
