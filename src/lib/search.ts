/**
 * Normalizes text for accent-insensitive, case-insensitive substring search
 * (e.g. so a search for "caete" matches "Caete acute").
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function matchesSearch(candidate: string, query: string): boolean {
  return normalizeForSearch(candidate).includes(normalizeForSearch(query));
}
