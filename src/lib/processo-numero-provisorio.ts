/**
 * A processo whose número couldn't be identified in the imported spreadsheet
 * cell still needs a stable, non-blank `numero` so re-importing the same row
 * doesn't recreate it as a duplicate (a blank número skips dedup entirely —
 * see src/features/importacao/actions.ts). The raw cell text is used as that
 * placeholder, tagged with this prefix so it can be told apart from a real
 * número and hidden from the user instead of being shown as if it were one.
 */
const PREFIX = '[SEM_NUMERO_IDENTIFICADO] ';

export function marcarNumeroProvisorio(textoOriginal: string): string {
  return `${PREFIX}${textoOriginal}`;
}

export function isNumeroProvisorio(numero: string | null | undefined): boolean {
  return !!numero && numero.startsWith(PREFIX);
}

/** Real número for display, or '' when it's just an internal placeholder. */
export function formatarNumeroProcesso(numero: string | null | undefined): string {
  return isNumeroProvisorio(numero) ? '' : (numero ?? '');
}

/** Same as formatarNumeroProcesso, but with a friendly fallback label instead of ''. */
export function rotuloNumeroProcesso(numero: string | null | undefined, semNumero = 'Sem processo'): string {
  return formatarNumeroProcesso(numero) || semNumero;
}
