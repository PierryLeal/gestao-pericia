import { describe, it, expect } from 'vitest';
import { textoDaCelula } from './cell-text';

describe('textoDaCelula', () => {
  it('returns an empty string for null/undefined', () => {
    expect(textoDaCelula(null)).toBe('');
    expect(textoDaCelula(undefined)).toBe('');
  });

  it('returns plain strings and numbers as text', () => {
    expect(textoDaCelula('Cleber')).toBe('Cleber');
    expect(textoDaCelula(42)).toBe('42');
  });

  it('unwraps a hyperlink cell to its display text', () => {
    expect(textoDaCelula({ text: 'Ana', hyperlink: 'mailto:ana@x.com' })).toBe('Ana');
  });

  it('joins the runs of a richText cell instead of stringifying the object', () => {
    const value = { richText: [{ text: 'Cleber' }, { text: ' ' }, { text: 'Silva' }] };
    expect(textoDaCelula(value)).toBe('Cleber Silva');
  });

  it('uses the computed result of a formula cell', () => {
    expect(textoDaCelula({ formula: 'A1&" "&B1', result: 'Maria x João' })).toBe('Maria x João');
  });

  it('uses the computed result of a shared-formula cell', () => {
    expect(textoDaCelula({ sharedFormula: 'A1', result: 123 })).toBe('123');
  });

  it('unwraps a formula cell whose result is itself richText', () => {
    const value = { formula: 'A1', result: { richText: [{ text: 'São' }, { text: ' Paulo' }] } };
    expect(textoDaCelula(value)).toBe('São Paulo');
  });

  it('returns an empty string for a formula cell with no result yet', () => {
    expect(textoDaCelula({ formula: 'A1', result: undefined })).toBe('');
  });

  it('returns an empty string for an error cell instead of "[object Object]"', () => {
    expect(textoDaCelula({ error: '#N/A' })).toBe('');
  });

  it('never produces "[object Object]" for the exceljs cell shapes it knows', () => {
    const shapes: unknown[] = [
      { richText: [{ text: 'a' }] },
      { formula: 'A1', result: 'b' },
      { text: 'c', hyperlink: 'http://x' },
      { error: '#REF!' },
    ];
    for (const shape of shapes) {
      expect(textoDaCelula(shape)).not.toContain('[object Object]');
    }
  });
});
