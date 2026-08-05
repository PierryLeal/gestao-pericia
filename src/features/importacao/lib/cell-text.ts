/**
 * Converts an exceljs cell value into plain text.
 *
 * exceljs represents a cell value as a primitive for simple cells, but as an
 * object for richer ones: `{ text, hyperlink }` for links, `{ richText: [...] }`
 * for mixed formatting (very common in hand-maintained spreadsheets),
 * `{ formula | sharedFormula, result }` for formulas and `{ error }` for error
 * cells. Falling through to `String(value)` on those object shapes produces the
 * literal string "[object Object]", which would then be imported as data.
 */
export function textoDaCelula(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);

  const objeto = value as Record<string, unknown>;

  if (Array.isArray(objeto.richText)) {
    return (objeto.richText as { text?: unknown }[])
      .map((run) => (run?.text === null || run?.text === undefined ? '' : String(run.text)))
      .join('');
  }

  if ('formula' in objeto || 'sharedFormula' in objeto) {
    return textoDaCelula(objeto.result);
  }

  if ('error' in objeto) return '';

  if ('text' in objeto) return objeto.text === null || objeto.text === undefined ? '' : String(objeto.text);

  return String(value);
}
