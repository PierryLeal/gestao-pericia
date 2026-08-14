import { describe, it, expect } from 'vitest';
import { nomeSuspeito } from './nome-suspeito';

describe('nomeSuspeito', () => {
  it('flags a single-character name', () => {
    expect(nomeSuspeito('I')).toBe(true);
    expect(nomeSuspeito('A')).toBe(true);
  });

  it('flags a single character surrounded by whitespace', () => {
    expect(nomeSuspeito('  I  ')).toBe(true);
  });

  it('does not flag a short but real name', () => {
    expect(nomeSuspeito('Ilg')).toBe(false);
    expect(nomeSuspeito('Jó')).toBe(false);
  });

  it('does not flag a blank name (that is a different, already-handled case)', () => {
    expect(nomeSuspeito('')).toBe(false);
    expect(nomeSuspeito('   ')).toBe(false);
  });

  it('does not flag an ordinary full name', () => {
    expect(nomeSuspeito('Maria Souza')).toBe(false);
  });
});
