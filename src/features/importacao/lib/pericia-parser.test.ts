import { describe, it, expect } from 'vitest';
import { parseColunaPericia, mapSituacao } from './pericia-parser';

describe('parseColunaPericia', () => {
  it('parses "autor x reu - numero"', () => {
    expect(parseColunaPericia('João x Maria - 0001234-56.2026')).toEqual({
      autor: 'João', reu: 'Maria', numeroProcesso: '0001234-56.2026',
    });
  });

  it('assigns "Vale" as reu when there is no " x " separator', () => {
    expect(parseColunaPericia('PAULO MONTEIRO - 5001808-87.2020.8.13.0301')).toEqual({
      autor: 'PAULO MONTEIRO', reu: 'Vale', numeroProcesso: '5001808-87.2020.8.13.0301',
    });
  });

  it('does not split on "x" inside a name (e.g. "Alex")', () => {
    expect(parseColunaPericia('Alex Souza - 123456')).toEqual({
      autor: 'Alex Souza', reu: 'Vale', numeroProcesso: '123456',
    });
  });

  it('matches "x" case-insensitively', () => {
    expect(parseColunaPericia('João X Maria - 123456')).toEqual({
      autor: 'João', reu: 'Maria', numeroProcesso: '123456',
    });
  });

  it('returns null when there is no " - " separator at all', () => {
    expect(parseColunaPericia('texto sem separador nenhum')).toBeNull();
  });

  it('uses the LAST " - " when the name portion itself contains a hyphenated word', () => {
    expect(parseColunaPericia('Silva - Junior x Réu - 123456')).toEqual({
      autor: 'Silva - Junior', reu: 'Réu', numeroProcesso: '123456',
    });
  });

  it('returns null when the numero portion would be empty', () => {
    expect(parseColunaPericia('João x Maria - ')).toBeNull();
  });
});

describe('mapSituacao', () => {
  it('maps "CAMPO" (case-insensitive) to marcada', () => {
    expect(mapSituacao('CAMPO')).toEqual({ situacao: 'marcada', reconhecida: true });
    expect(mapSituacao('campo')).toEqual({ situacao: 'marcada', reconhecida: true });
  });

  it('maps empty or whitespace-only to pendente', () => {
    expect(mapSituacao('')).toEqual({ situacao: 'pendente', reconhecida: true });
    expect(mapSituacao('   ')).toEqual({ situacao: 'pendente', reconhecida: true });
  });

  it('flags any other value as not recognized, defaulting to pendente', () => {
    expect(mapSituacao('REALIZADA')).toEqual({ situacao: 'pendente', reconhecida: false });
  });
});
