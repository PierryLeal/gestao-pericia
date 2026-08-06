import { normalizeForSearch } from '@/lib/search';

/** The map key used to detect the same name/número repeated within one batch. */
export function chaveDeLote(nome: string): string {
  return normalizeForSearch(nome);
}
