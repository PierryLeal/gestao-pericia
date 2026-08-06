import { describe, it, expect } from 'vitest';
import { mapJaTrabalhamos, mapRelacao, mapResultados } from './perito-colaborador-parser';

describe('mapJaTrabalhamos', () => {
  it('maps "SIM" and "X" (case-insensitive) to true', () => {
    expect(mapJaTrabalhamos('SIM')).toBe(true);
    expect(mapJaTrabalhamos('sim')).toBe(true);
    expect(mapJaTrabalhamos('x')).toBe(true);
    expect(mapJaTrabalhamos('X')).toBe(true);
  });

  it('maps empty and "NÃO" to false', () => {
    expect(mapJaTrabalhamos('')).toBe(false);
    expect(mapJaTrabalhamos('NÃO')).toBe(false);
    expect(mapJaTrabalhamos('não')).toBe(false);
  });
});

describe('mapRelacao', () => {
  it('maps the known values case-insensitively', () => {
    expect(mapRelacao('BOA')).toEqual({ relacao: 'boa', reconhecida: true });
    expect(mapRelacao('otima')).toEqual({ relacao: 'otima', reconhecida: true });
    expect(mapRelacao('ruim')).toEqual({ relacao: 'ruim', reconhecida: true });
  });

  it('maps an accented value (e.g. a sheet cell reading "ÓTIMA") to its accent-free equivalent', () => {
    expect(mapRelacao('ÓTIMA')).toEqual({ relacao: 'otima', reconhecida: true });
  });

  it('maps empty to neutra', () => {
    expect(mapRelacao('')).toEqual({ relacao: 'neutra', reconhecida: true });
  });

  it('flags an unrecognized value, defaulting to neutra', () => {
    expect(mapRelacao('excelente')).toEqual({ relacao: 'neutra', reconhecida: false });
  });
});

describe('mapResultados', () => {
  it('maps the known values case-insensitively', () => {
    expect(mapResultados('POSITIVO')).toEqual({ resultados: 'positivo', reconhecida: true });
    expect(mapResultados('negativo')).toEqual({ resultados: 'negativo', reconhecida: true });
  });

  it('maps empty to parcial', () => {
    expect(mapResultados('')).toEqual({ resultados: 'parcial', reconhecida: true });
  });

  it('flags an unrecognized value, defaulting to parcial', () => {
    expect(mapResultados('excelente')).toEqual({ resultados: 'parcial', reconhecida: false });
  });
});
