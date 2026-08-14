import { describe, it, expect } from 'vitest';
import { marcarNumeroProvisorio, isNumeroProvisorio, formatarNumeroProcesso } from './processo-numero-provisorio';

describe('marcarNumeroProvisorio / isNumeroProvisorio', () => {
  it('tags the original text so it can be recognized later', () => {
    const marcado = marcarNumeroProvisorio('MBR X UNIÃO FEDERAL-ITR 2003 - CAPÃO XAVIER');
    expect(isNumeroProvisorio(marcado)).toBe(true);
  });

  it('does not flag a real processo número as provisório', () => {
    expect(isNumeroProvisorio('5001234-56.2026.8.13.0090')).toBe(false);
  });

  it('does not flag null/undefined/empty as provisório', () => {
    expect(isNumeroProvisorio(null)).toBe(false);
    expect(isNumeroProvisorio(undefined)).toBe(false);
    expect(isNumeroProvisorio('')).toBe(false);
  });
});

describe('formatarNumeroProcesso', () => {
  it('returns the real número unchanged', () => {
    expect(formatarNumeroProcesso('5001234-56.2026.8.13.0090')).toBe('5001234-56.2026.8.13.0090');
  });

  it('returns an empty string for a provisório número instead of the raw placeholder text', () => {
    const marcado = marcarNumeroProvisorio('MBR X UNIÃO FEDERAL-ITR 2003 - CAPÃO XAVIER');
    expect(formatarNumeroProcesso(marcado)).toBe('');
  });

  it('returns an empty string for null/undefined', () => {
    expect(formatarNumeroProcesso(null)).toBe('');
    expect(formatarNumeroProcesso(undefined)).toBe('');
  });
});
