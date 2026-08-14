import { describe, it, expect } from 'vitest';
import { processoSchema, processoImportSchema } from './schemas';

describe('processoSchema', () => {
  it('requires numero, autor and reu', () => {
    const result = processoSchema.safeParse({ numero: '', autor: '', reu: '', escritorio: '' });
    expect(result.success).toBe(false);
  });

  it('accepts a fully filled processo', () => {
    const result = processoSchema.safeParse({ numero: 'P-1', autor: 'Ana', reu: 'Bia', escritorio: 'PMRA' });
    expect(result.success).toBe(true);
  });
});

describe('processoImportSchema', () => {
  it('still requires numero', () => {
    const result = processoImportSchema.safeParse({ numero: '', autor: '', reu: '', escritorio: '' });
    expect(result.success).toBe(false);
  });

  it('accepts a blank autor and réu, unlike the strict processoSchema', () => {
    const result = processoImportSchema.safeParse({ numero: 'P-1', autor: '', reu: '', escritorio: '' });
    expect(result.success).toBe(true);
  });

  it('accepts an optional contrato', () => {
    const result = processoImportSchema.safeParse({ numero: 'P-1', autor: '', reu: '', escritorio: '', contrato: 'VALE AT' });
    expect(result.success).toBe(true);
  });
});
