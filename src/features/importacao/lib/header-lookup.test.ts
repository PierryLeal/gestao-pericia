import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { encontrarIndiceColuna, encontrarLinhaComTexto } from './header-lookup';

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
