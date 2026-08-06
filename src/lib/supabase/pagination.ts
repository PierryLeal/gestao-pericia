/**
 * Supabase/PostgREST caps a single request at the project's "max rows"
 * setting (1000 by default) — an unbounded `.select()` doesn't error past
 * that cap, it silently truncates. Any `list*` action that needs the
 * *complete* table (not a display page) must page through `.range()` until
 * a page comes back short of `tamanhoPagina`, or it will quietly miss rows
 * once the table grows past the cap — exactly the kind of gap that shows up
 * as "already exists" errors on a bulk import re-run once older rows fall
 * outside the truncated result.
 */
export async function buscarTodasAsPaginas<T>(
  construirPagina: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tamanhoPagina = 1000
): Promise<T[]> {
  const todas: T[] = [];
  let pagina = 0;
  for (;;) {
    const inicio = pagina * tamanhoPagina;
    const fim = inicio + tamanhoPagina - 1;
    const { data, error } = await construirPagina(inicio, fim);
    if (error) throw new Error(error.message);
    const linhas = data ?? [];
    todas.push(...linhas);
    if (linhas.length < tamanhoPagina) break;
    pagina++;
  }
  return todas;
}
