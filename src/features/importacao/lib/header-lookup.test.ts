import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { encontrarIndiceColuna, encontrarLinhaComTexto, encontrarLinhaComColuna } from './header-lookup';

async function criarPlanilha(linhas: string[][]): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Teste');
  linhas.forEach((linha) => worksheet.addRow(linha));
  return worksheet;
}

describe('encontrarIndiceColuna', () => {
  it('finds a column by one of its accepted header spellings, case-insensitively', async () => {
    const worksheet = await criarPlanilha([['PERÍCIA', 'data', 'Hora']]);
    const headerRow = worksheet.getRow(1);
    expect(encontrarIndiceColuna(headerRow, ['PERÍCIA', 'PERICIA'])).toBe(1);
    expect(encontrarIndiceColuna(headerRow, ['DATA'])).toBe(2);
  });

  it('returns null when no accepted spelling is found', async () => {
    const worksheet = await criarPlanilha([['PERÍCIA', 'DATA']]);
    const headerRow = worksheet.getRow(1);
    expect(encontrarIndiceColuna(headerRow, ['LOCAL'])).toBeNull();
  });

  it('matches a header cell whose text is split into richText runs', async () => {
    const worksheet = await criarPlanilha([['PERÍCIA', '']]);
    worksheet.getRow(1).getCell(2).value = { richText: [{ text: 'DA' }, { text: 'TA' }] };
    expect(encontrarIndiceColuna(worksheet.getRow(1), ['DATA'])).toBe(2);
  });

  it('matches a header cell produced by a formula, using its result', async () => {
    const worksheet = await criarPlanilha([['PERÍCIA', '']]);
    worksheet.getRow(1).getCell(2).value = { formula: 'Z1', result: 'LOCAL', date1904: false };
    expect(encontrarIndiceColuna(worksheet.getRow(1), ['LOCAL'])).toBe(2);
  });
});

describe('encontrarLinhaComTexto', () => {
  it('returns the row number of the first row containing a cell matching the text exactly (case-insensitive)', async () => {
    const worksheet = await criarPlanilha([
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['Ana', '31999990000'],
      [],
      ['PERITO', 'CONTATO', 'FORMAÇÃO'],
      ['Carlos', '31988880000', 'Eng. Civil'],
    ]);
    expect(encontrarLinhaComTexto(worksheet, 'PERITO')).toBe(4);
  });

  it('returns null when no row contains the text', async () => {
    const worksheet = await criarPlanilha([['A', 'B'], ['C', 'D']]);
    expect(encontrarLinhaComTexto(worksheet, 'PERITO')).toBeNull();
  });
});

describe('encontrarLinhaComColuna', () => {
  it('finds the header row by one of its accepted spellings, even below a title row', async () => {
    const worksheet = await criarPlanilha([
      ['RELATÓRIO DE PERÍCIAS 2026'],
      ['PERÍCIA', 'DATA', 'HORA'],
      ['Maria x João', '20/09/2026', '10:00'],
    ]);
    expect(encontrarLinhaComColuna(worksheet, ['PERÍCIA', 'PERICIA'])).toBe(2);
  });

  it('returns the first row when there is no title row above the header', async () => {
    const worksheet = await criarPlanilha([['PERÍCIA', 'DATA'], ['Maria x João', '20/09/2026']]);
    expect(encontrarLinhaComColuna(worksheet, ['PERÍCIA', 'PERICIA'])).toBe(1);
  });

  it('returns null when no row has a column matching any accepted spelling', async () => {
    const worksheet = await criarPlanilha([['A', 'B'], ['C', 'D']]);
    expect(encontrarLinhaComColuna(worksheet, ['PERÍCIA', 'PERICIA'])).toBeNull();
  });
});
