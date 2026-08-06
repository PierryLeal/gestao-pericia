import { describe, it, expect } from 'vitest';
import { parseDataCelula, parseHoraCelula } from './date-parsing';

describe('parseDataCelula', () => {
  // exceljs anchors date-only cells at UTC midnight regardless of the
  // runtime's timezone, so the fixture must be built the same way (Date.UTC),
  // not via the local constructor — a local-time fixture can't catch a
  // UTC-vs-local getter bug because it's tautologically timezone-invariant.
  it('formats a Date cell value using UTC getters (YYYY-MM-DD)', () => {
    expect(parseDataCelula(new Date(Date.UTC(2026, 8, 20, 0, 0)))).toBe('2026-09-20');
  });

  it('parses a DD/MM/YYYY text value', () => {
    expect(parseDataCelula('20/09/2026')).toBe('2026-09-20');
  });

  it('parses a YYYY-MM-DD text value as-is', () => {
    expect(parseDataCelula('2026-09-20')).toBe('2026-09-20');
  });

  it('returns null for an empty or unparseable value', () => {
    expect(parseDataCelula('')).toBeNull();
    expect(parseDataCelula(null)).toBeNull();
    expect(parseDataCelula('não é uma data')).toBeNull();
  });
});

describe('parseHoraCelula', () => {
  it('formats a Date cell value using UTC getters (HH:MM)', () => {
    expect(parseHoraCelula(new Date(Date.UTC(1899, 11, 30, 14, 30)))).toBe('14:30');
  });

  it('parses an HH:MM text value', () => {
    expect(parseHoraCelula('14:30')).toBe('14:30');
  });

  it('parses an HH:MM:SS text value by dropping the seconds', () => {
    expect(parseHoraCelula('14:30:00')).toBe('14:30');
  });

  it('returns null for an empty or unparseable value', () => {
    expect(parseHoraCelula('')).toBeNull();
    expect(parseHoraCelula(null)).toBeNull();
    expect(parseHoraCelula('não é uma hora')).toBeNull();
  });
});
