/**
 * A single character ("I", "A"...) is never a real full name — it's almost
 * always a parsing artifact (a stray initial, a truncated cell). Real short
 * names (e.g. "Ilg") are still 2+ characters, so this stays conservative on
 * purpose: length alone, nothing about "looks like a name".
 */
export function nomeSuspeito(nome: string): boolean {
  return nome.trim().length === 1;
}
