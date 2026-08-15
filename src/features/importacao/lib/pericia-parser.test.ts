import { describe, it, expect } from 'vitest';
import { parseColunaPericia, mapSituacao, splitColaboradorNomes } from './pericia-parser';

describe('parseColunaPericia', () => {
  it('parses "autor x reu - numero"', () => {
    expect(parseColunaPericia('João x Maria - 0001234-56.2026')).toEqual({
      autor: 'João', reu: 'Maria', numeroProcesso: '0001234-56.2026',
    });
  });

  it('leaves reu blank (not a guessed default) when there is no " x " separator', () => {
    expect(parseColunaPericia('PAULO MONTEIRO - 5001808-87.2020.8.13.0301')).toEqual({
      autor: 'PAULO MONTEIRO', reu: '', numeroProcesso: '5001808-87.2020.8.13.0301',
    });
  });

  it('does not split on "x" inside a name (e.g. "Alex")', () => {
    expect(parseColunaPericia('Alex Souza - 123456')).toEqual({
      autor: 'Alex Souza', reu: '', numeroProcesso: '123456',
    });
  });

  it('matches "x" case-insensitively', () => {
    expect(parseColunaPericia('João X Maria - 123456')).toEqual({
      autor: 'João', reu: 'Maria', numeroProcesso: '123456',
    });
  });

  it('returns null when there is no " - " separator at all and no digit either', () => {
    expect(parseColunaPericia('texto sem separador nenhum')).toBeNull();
  });

  it('treats a bare short code with a digit and no separator as a real número (e.g. "LT 74")', () => {
    expect(parseColunaPericia('LT 74')).toEqual({ autor: '', reu: '', numeroProcesso: 'LT 74' });
  });

  it('uses the LAST " - " when the name portion itself contains a hyphenated word', () => {
    expect(parseColunaPericia('Silva - Junior x Réu - 123456')).toEqual({
      autor: 'Silva - Junior', reu: 'Réu', numeroProcesso: '123456',
    });
  });

  it('returns null when the numero portion would be empty', () => {
    expect(parseColunaPericia('João x Maria - ')).toBeNull();
  });

  it('finds a CNJ-format número even with a "nome- número" separator (dash, no leading space)', () => {
    expect(parseColunaPericia('MURILO LOPES FERREIRA- 5001487-40.2019.8.13.0090')).toEqual({
      autor: 'MURILO LOPES FERREIRA', reu: '', numeroProcesso: '5001487-40.2019.8.13.0090',
    });
  });

  it('finds a CNJ-format número separated by an en dash ("–")', () => {
    expect(parseColunaPericia('IRANI GONCALVES PIMENTA LIMA – 5006889-93.2020.8.13.0114')).toEqual({
      autor: 'IRANI GONCALVES PIMENTA LIMA', reu: '', numeroProcesso: '5006889-93.2020.8.13.0114',
    });
  });

  it('finds a CNJ-format número with "nome -número" separator (dash, no trailing space)', () => {
    expect(parseColunaPericia('GERALDA LUIZA DE SOUZA -5002269-37.2022.8.13.0027')).toEqual({
      autor: 'GERALDA LUIZA DE SOUZA', reu: '', numeroProcesso: '5002269-37.2022.8.13.0027',
    });
  });

  it('finds a name after the CNJ número when nothing precedes it ("número - autor x réu")', () => {
    expect(parseColunaPericia('5000556-39.2020.8.13.0175 - ANGLO x ANTÔNIO COSTA DE OLIVEIRA')).toEqual({
      autor: 'ANGLO', reu: 'ANTÔNIO COSTA DE OLIVEIRA', numeroProcesso: '5000556-39.2020.8.13.0175',
    });
  });

  it('prefers the text before the número when both sides have text', () => {
    expect(parseColunaPericia('ANGLO x ANTÔNIO - 5000556-39.2020.8.13.0175 - ignorado')).toEqual({
      autor: 'ANGLO', reu: 'ANTÔNIO', numeroProcesso: '5000556-39.2020.8.13.0175',
    });
  });

  it('splits autor/réu on " x " even with a CNJ número and a tight dash separator', () => {
    expect(parseColunaPericia('MARINA E WILTON X VALE- 5000000-00.2021.8.13.0090')).toEqual({
      autor: 'MARINA E WILTON', reu: 'VALE', numeroProcesso: '5000000-00.2021.8.13.0090',
    });
  });

  it('returns an empty autor/réu for a bare CNJ número with no name prefix', () => {
    expect(parseColunaPericia('5003036-80.2022.8.13.0090')).toEqual({
      autor: '', reu: '', numeroProcesso: '5003036-80.2022.8.13.0090',
    });
  });

  it('still returns null when there is truly no processo número in any recognizable shape', () => {
    expect(parseColunaPericia('MARIA TERESA HOOGENBOOM X VALE')).toBeNull();
  });

  it('does not mistake a place name after the last " - " for a número (no digits)', () => {
    expect(parseColunaPericia('MBR X UNIÃO FEDERAL-ITR 2003 - CAPÃO XAVIER')).toEqual({
      autor: 'MBR', reu: 'UNIÃO FEDERAL-ITR 2003 - CAPÃO XAVIER', numeroProcesso: '',
    });
  });

  it('still treats the text after the last " - " as número when it contains a digit (internal code)', () => {
    expect(parseColunaPericia('JOÃO SILVA - FC.02.01.055')).toEqual({
      autor: 'JOÃO SILVA', reu: '', numeroProcesso: 'FC.02.01.055',
    });
  });

  it('returns null (rather than guessing an autor) when there is no "x" and no digit after the last " - "', () => {
    expect(parseColunaPericia('MINA BRUCUTU - VARGEM DA LUA (REUNIÃO)')).toBeNull();
  });
});

describe('mapSituacao', () => {
  it('maps "CAMPO" (case-insensitive) to marcada', () => {
    expect(mapSituacao('CAMPO')).toEqual({ situacao: 'marcada', reconhecida: true });
    expect(mapSituacao('campo')).toEqual({ situacao: 'marcada', reconhecida: true });
  });

  it('maps "OK" (case-insensitive) to realizada', () => {
    expect(mapSituacao('OK')).toEqual({ situacao: 'realizada', reconhecida: true });
    expect(mapSituacao('ok')).toEqual({ situacao: 'realizada', reconhecida: true });
  });

  it('maps empty or whitespace-only to pendente', () => {
    expect(mapSituacao('')).toEqual({ situacao: 'pendente', reconhecida: true });
    expect(mapSituacao('   ')).toEqual({ situacao: 'pendente', reconhecida: true });
  });

  it('maps a canonical situação word (case-insensitive) directly to itself', () => {
    expect(mapSituacao('REALIZADA')).toEqual({ situacao: 'realizada', reconhecida: true });
    expect(mapSituacao('cancelada')).toEqual({ situacao: 'cancelada', reconhecida: true });
    expect(mapSituacao('Marcada')).toEqual({ situacao: 'marcada', reconhecida: true });
    expect(mapSituacao('Pendente')).toEqual({ situacao: 'pendente', reconhecida: true });
  });

  it('flags any other value as not recognized, defaulting to pendente', () => {
    expect(mapSituacao('EM ANDAMENTO')).toEqual({ situacao: 'pendente', reconhecida: false });
  });
});

describe('splitColaboradorNomes', () => {
  it('splits multiple colaboradores separated by "/"', () => {
    expect(splitColaboradorNomes('Igor Navarro/Julio Cesar Mulatti')).toEqual([
      'Igor Navarro', 'Julio Cesar Mulatti',
    ]);
  });

  it('trims whitespace around each name', () => {
    expect(splitColaboradorNomes('Igor Navarro / Julio Cesar Mulatti')).toEqual([
      'Igor Navarro', 'Julio Cesar Mulatti',
    ]);
  });

  it('returns a single-item array for a single colaborador', () => {
    expect(splitColaboradorNomes('Igor Navarro')).toEqual(['Igor Navarro']);
  });

  it('returns an empty array for an empty or blank cell', () => {
    expect(splitColaboradorNomes('')).toEqual([]);
    expect(splitColaboradorNomes('   ')).toEqual([]);
  });

  it('drops empty segments from a trailing or doubled separator', () => {
    expect(splitColaboradorNomes('Igor Navarro/')).toEqual(['Igor Navarro']);
    expect(splitColaboradorNomes('Igor Navarro//Julio Cesar Mulatti')).toEqual([
      'Igor Navarro', 'Julio Cesar Mulatti',
    ]);
  });
});
