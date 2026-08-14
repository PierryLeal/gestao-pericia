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

/**
 * PostgREST puts filter values straight in the URL, so a plain
 * `.in('coluna', ids)` with enough ids blows past the ~16KB HTTP header
 * limit and the request fails outright — not a PostgREST error response,
 * the HTTP client refuses to even parse it ("HeadersOverflowError" /
 * "fetch failed"). This showed up in production once a real dataset (2000+
 * pericias) pushed a single `.in('pericia_id', allIds)` query past that
 * limit. Splitting `ids` into safely-sized chunks — each still paginated
 * via `buscarTodasAsPaginas`, since a chunk's own RESULT rows (e.g. several
 * colaboradores per pericia) can independently exceed the 1000-row cap —
 * keeps this working regardless of how large the table grows.
 */
export async function buscarPorIdsEmLotes<T>(
  ids: number[],
  construirConsulta: (
    idsDoLote: number[],
    inicio: number,
    fim: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tamanhoLote = 500
): Promise<T[]> {
  const todas: T[] = [];
  for (let i = 0; i < ids.length; i += tamanhoLote) {
    const idsDoLote = ids.slice(i, i + tamanhoLote);
    const linhas = await buscarTodasAsPaginas((inicio, fim) => construirConsulta(idsDoLote, inicio, fim));
    todas.push(...linhas);
  }
  return todas;
}
