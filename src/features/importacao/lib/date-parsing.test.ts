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

  // Confirmed against a real sheet (TESTE all.xlsx, row 2220): "7 de novembro"
  // typed under a US-locale Excel session gets stored as July 11th — but the
  // cell's own display format (month-first) still renders it back as
  // "7/11/23", so there's no visible sign of the swap. The cell's numFmt is
  // the only remaining evidence of which locale resolved the typed digits.
  describe('day/month swap recovery for US-locale-typed Date cells', () => {
    it('swaps day/month when the numFmt is month-first and the day is ambiguous (<=12)', () => {
      // Stored as July 11th (month=7, day=11) under numFmt "m/d/yy" — the
      // sheet author meant 7 de novembro (day=7, month=11).
      expect(parseDataCelula(new Date(Date.UTC(2023, 6, 11)), 'm/d/yy')).toBe('2023-11-07');
    });

    it('also swaps for the fully-padded "mm/dd/yyyy" numFmt spelling', () => {
      expect(parseDataCelula(new Date(Date.UTC(2023, 6, 11)), 'mm/dd/yyyy')).toBe('2023-11-07');
    });

    it('does not swap when the numFmt is day-first (the normal case)', () => {
      expect(parseDataCelula(new Date(Date.UTC(2023, 6, 11)), 'dd/mm/yyyy')).toBe('2023-07-11');
    });

    it('does not swap when no numFmt is provided', () => {
      expect(parseDataCelula(new Date(Date.UTC(2023, 6, 11)))).toBe('2023-07-11');
    });

    it('does not swap when the day exceeds 12 — the value is unambiguous regardless of numFmt', () => {
      // day=19 can never be a valid month, so this could only ever have been
      // stored as September 19th, no matter which locale resolved it.
      expect(parseDataCelula(new Date(Date.UTC(2023, 8, 19)), 'm/d/yy')).toBe('2023-09-19');
    });

    it('is a no-op when day and month are the same value', () => {
      expect(parseDataCelula(new Date(Date.UTC(2023, 4, 5)), 'm/d/yy')).toBe('2023-05-05');
    });
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
