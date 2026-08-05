import type { Row, Worksheet } from 'exceljs';
import { textoDaCelula } from './cell-text';

function normalizarTextoCelula(value: unknown): string {
  return textoDaCelula(value).trim().toLowerCase();
}

/** Returns the 1-based column index of the first cell in `row` whose text
 *  matches (case-insensitively) one of `nomesAceitos`, or null if none do. */
export function encontrarIndiceColuna(row: Row, nomesAceitos: string[]): number | null {
  const aceitos = nomesAceitos.map((n) => n.trim().toLowerCase());
  let indiceEncontrado: number | null = null;
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (indiceEncontrado !== null) return;
    if (aceitos.includes(normalizarTextoCelula(cell.value))) {
      indiceEncontrado = colNumber;
    }
  });
  return indiceEncontrado;
}

/** Returns the 1-based row number of the first row in `worksheet` containing
 *  a cell whose text matches `texto` exactly (case-insensitive), or null. */
export function encontrarLinhaComTexto(worksheet: Worksheet, texto: string): number | null {
  const alvo = texto.trim().toLowerCase();
  let linhaEncontrada: number | null = null;
  worksheet.eachRow((row, rowNumber) => {
    if (linhaEncontrada !== null) return;
    let encontrouNaLinha = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (normalizarTextoCelula(cell.value) === alvo) encontrouNaLinha = true;
    });
    if (encontrouNaLinha) linhaEncontrada = rowNumber;
  });
  return linhaEncontrada;
}
