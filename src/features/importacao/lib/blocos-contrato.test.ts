import ExcelJS from 'exceljs';
import { describe, it, expect } from 'vitest';
import { encontrarBlocosDeContrato } from './blocos-contrato';

const NOMES_PERICIA = ['PERÍCIA', 'PERICIA'];

async function criarPlanilha(linhas: (string | null)[][]): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Perícias');
  linhas.forEach((linha) => worksheet.addRow(linha));
  return worksheet;
}

const HEADER = ['PERÍCIA', 'DATA', 'HORA', 'LOCAL', 'PERITO', 'CAMPO', 'SITUAÇÃO', 'OBS.', 'ESCRITÓRIOS'];
function banner(nome: string): string[] {
  return Array(9).fill(nome);
}

describe('encontrarBlocosDeContrato', () => {
  it('returns a single block with contrato null when there is no banner row at all', async () => {
    const worksheet = await criarPlanilha([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', '', '', '', '', '', ''],
    ]);

    const blocos = encontrarBlocosDeContrato(worksheet, NOMES_PERICIA);

    expect(blocos).toEqual([{ contrato: null, linhaCabecalho: 1, linhaFim: 2 }]);
  });

  it('reads the contrato name from a banner row directly above the header', async () => {
    const worksheet = await criarPlanilha([
      banner('VALE AT'),
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', '', '', '', '', '', ''],
    ]);

    const blocos = encontrarBlocosDeContrato(worksheet, NOMES_PERICIA);

    expect(blocos).toEqual([{ contrato: 'VALE AT', linhaCabecalho: 2, linhaFim: 3 }]);
  });

  it('splits a sheet with several contrato blocks, each owning its own row range', async () => {
    const worksheet = await criarPlanilha([
      banner('VALE AT'),
      HEADER,
      ['Linha 1 - 0001111-11.2026', '', '', '', '', '', '', '', ''],
      ['Linha 2 - 0002222-22.2026', '', '', '', '', '', '', '', ''],
      banner('VALE BRUMADINHO'),
      HEADER,
      ['Linha 3 - 0003333-33.2026', '', '', '', '', '', '', '', ''],
    ]);

    const blocos = encontrarBlocosDeContrato(worksheet, NOMES_PERICIA);

    expect(blocos).toEqual([
      { contrato: 'VALE AT', linhaCabecalho: 2, linhaFim: 4 },
      { contrato: 'VALE BRUMADINHO', linhaCabecalho: 6, linhaFim: 7 },
    ]);
  });

  it('treats a title row above the header as not-a-banner when its text is not repeated across cells', async () => {
    const worksheet = await criarPlanilha([
      ['RELATÓRIO DE PERÍCIAS 2026'],
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', '', '', '', '', '', ''],
    ]);

    const blocos = encontrarBlocosDeContrato(worksheet, NOMES_PERICIA);

    expect(blocos).toEqual([{ contrato: null, linhaCabecalho: 2, linhaFim: 3 }]);
  });

  it('handles a banner that only spans a few columns (shorter blocks in the sheet)', async () => {
    const worksheet = await criarPlanilha([
      Array(7).fill('ANGLO'),
      ['PERÍCIA', 'DATA', 'HORA', 'LOCAL', 'PERITO', 'CAMPO', 'SITUAÇÃO'],
      ['Linha 1 - 0001111-11.2026', '', '', '', '', '', ''],
    ]);

    const blocos = encontrarBlocosDeContrato(worksheet, NOMES_PERICIA);

    expect(blocos).toEqual([{ contrato: 'ANGLO', linhaCabecalho: 2, linhaFim: 3 }]);
  });

  it('returns an empty array when the sheet has no PERÍCIA header at all', async () => {
    const worksheet = await criarPlanilha([['nada aqui']]);

    expect(encontrarBlocosDeContrato(worksheet, NOMES_PERICIA)).toEqual([]);
  });
});
