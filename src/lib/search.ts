/**
 * Normalizes text for accent-insensitive, case-insensitive substring search
 * (e.g. so a search for "caete" matches "Caete acute") — and, just as
 * importantly, for "does this entity already exist" name matching during
 * import. A trailing/doubled space is a common copy-paste artifact in real
 * spreadsheets; left uncollapsed, "Nome " and "Nome" normalize to different
 * strings, so the same real perito/colaborador/processo silently gets a
 * second, duplicate cadastro record instead of being recognized as existing
 * (confirmed in production: a perito with a stray trailing space in one sheet
 * row got created twice).
 */
export function normalizeForSearch(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function matchesSearch(candidate: string, query: string): boolean {
  return normalizeForSearch(candidate).includes(normalizeForSearch(query));
}
