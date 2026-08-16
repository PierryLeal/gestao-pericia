/**
 * URL search params only hold strings, so a multi-select contrato filter is
 * joined/split on "," (a contrato name never contains a comma in practice).
 * Plain functions (no 'use client') so a server component can parse the
 * param without crossing into the client bundle.
 */
export function serializeContratos(contratos: string[]): string {
  return contratos.join(',');
}

export function parseContratos(value: string | null | undefined): string[] {
  return (value ?? '').split(',').map((v) => v.trim()).filter(Boolean);
}
