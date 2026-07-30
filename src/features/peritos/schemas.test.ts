import { describe, it, expect } from 'vitest';
import { peritoSchema, relacaoOptions, resultadoOptions } from './schemas';

describe('peritoSchema', () => {
  it('accepts the known relacao and resultado values', () => {
    const result = peritoSchema.safeParse({
      nome: 'Carlos', relacao: 'boa', resultados: 'positivo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a relacao value outside the fixed set', () => {
    const result = peritoSchema.safeParse({ nome: 'Carlos', relacao: 'excelente' });
    expect(result.success).toBe(false);
  });

  it('exports the exact option lists used by the UI', () => {
    expect(relacaoOptions).toEqual(['ruim', 'neutra', 'boa', 'otima']);
    expect(resultadoOptions).toEqual(['negativo', 'parcial', 'positivo']);
  });
});
