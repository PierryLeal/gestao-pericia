import type { Worksheet } from 'exceljs';
import { encontrarIndiceColuna } from './header-lookup';
import { textoDaCelula } from './cell-text';

export type BlocoContrato = {
  contrato: string | null;
  linhaCabecalho: number;
  /** Inclusive — the last row belonging to this block. */
  linhaFim: number;
};

/**
 * A newer spreadsheet format groups rows under a banner row naming the
 * "contrato" (e.g. "VALE BRUMADINHO", spanning several merged cells),
 * immediately followed by the usual PERÍCIA/DATA/HORA/... header row — and a
 * single sheet can contain several such blocks back to back, one per
 * contrato. Finds every PERÍCIA-header row in the sheet (not just the
 * first) and pairs each with the banner directly above it, if there is one.
 *
 * An older, single-block sheet with no banner at all still works exactly as
 * before — it comes back as one block with `contrato: null`.
 */
export function encontrarBlocosDeContrato(worksheet: Worksheet, nomesColunaPericia: string[]): BlocoContrato[] {
  const cabecalhos: { linha: number; contrato: string | null }[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (encontrarIndiceColuna(row, nomesColunaPericia) === null) return;
    cabecalhos.push({ linha: rowNumber, contrato: lerBannerDeContrato(worksheet, rowNumber - 1) });
  });

  return cabecalhos.map((cabecalho, i) => ({
    contrato: cabecalho.contrato,
    linhaCabecalho: cabecalho.linha,
    linhaFim: i + 1 < cabecalhos.length ? cabecalhos[i + 1].linha - 2 : worksheet.rowCount,
  }));
}

/** A banner row's non-empty cells all repeat the same text — a merged cell
 *  reads back from exceljs as that value duplicated across every column it
 *  spans. Anything else (a title, a blank row, a different header) isn't one. */
function lerBannerDeContrato(worksheet: Worksheet, linha: number): string | null {
  if (linha < 1) return null;
  const valores: string[] = [];
  worksheet.getRow(linha).eachCell({ includeEmpty: false }, (cell) => {
    const texto = textoDaCelula(cell.value).trim();
    if (texto) valores.push(texto);
  });
  if (valores.length < 2) return null;
  const distintos = new Set(valores.map((v) => v.toUpperCase()));
  return distintos.size === 1 ? valores[0] : null;
}
