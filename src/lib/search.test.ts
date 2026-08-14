import { describe, it, expect } from 'vitest';
import { normalizeForSearch, matchesSearch } from './search';

describe('normalizeForSearch', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeForSearch('Caeté')).toBe('caete');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeForSearch('  Maria Souza  ')).toBe('maria souza');
  });

  it('collapses internal repeated whitespace to a single space', () => {
    expect(normalizeForSearch('Maria   Souza')).toBe('maria souza');
  });

  it('makes a name with a stray trailing space match its clean counterpart', () => {
    // Confirmed in production: a sheet cell like "Guilherme Moreira " (with a
    // trailing space) failed to match the already-cadastered "Guilherme
    // Moreira", creating a duplicate perito record on every import.
    expect(normalizeForSearch('Guilherme Moreira ')).toBe(normalizeForSearch('Guilherme Moreira'));
  });
});

describe('matchesSearch', () => {
  it('matches accent/case-insensitively', () => {
    expect(matchesSearch('Caeté', 'caete')).toBe(true);
  });

  it('matches when the query has incidental whitespace', () => {
    expect(matchesSearch('Maria Souza', '  souza  ')).toBe(true);
  });
});
