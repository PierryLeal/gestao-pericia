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

  it('parses a D/M/YYYY text value with no leading zeros', () => {
    expect(parseDataCelula('9/5/2026')).toBe('2026-05-09');
  });

  it('parses a YYYY-MM-DD text value as-is', () => {
    expect(parseDataCelula('2026-09-20')).toBe('2026-09-20');
  });

  // The dominant real-world format in an actual imported sheet: hand-typed
  // cells with a 2-digit year and no leading zero on day/month (e.g. "14/6/22").
  // Confirmed against production data: without this, over half the rows in a
  // real sheet (1289 of 2391 date cells) silently lost their scheduled date.
  it('parses a D/M/YY text value with a 2-digit year, pivoting 00-68 to 20xx', () => {
    expect(parseDataCelula('14/6/22')).toBe('2022-06-14');
    expect(parseDataCelula('27/2/26')).toBe('2026-02-27');
  });

  it('parses a DD/MM/YY text value with a 2-digit year', () => {
    expect(parseDataCelula('18/10/22')).toBe('2022-10-18');
  });

  it('pivots a 2-digit year of 69-99 to 19xx', () => {
    expect(parseDataCelula('1/1/69')).toBe('1969-01-01');
    expect(parseDataCelula('1/1/99')).toBe('1999-01-01');
  });

  it('returns null for an empty or unparseable value', () => {
    expect(parseDataCelula('')).toBeNull();
    expect(parseDataCelula(null)).toBeNull();
    expect(parseDataCelula('não é uma data')).toBeNull();
    // A genuine data-entry typo in the source sheet (an invalid "30-31" day
    // range before the real date) — correctly stays unparseable rather than
    // guessing at malformed input.
    expect(parseDataCelula('30-31-01/11/2020')).toBeNull();
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
