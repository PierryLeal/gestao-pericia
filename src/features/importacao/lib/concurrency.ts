/**
 * Runs `fn` over `items` with at most `limite` calls in flight at once
 * (a fixed-size worker pool), instead of a plain `for` loop's one-at-a-time
 * `await`. Order of `items` is preserved in the returned array regardless of
 * completion order.
 */
export async function mapComConcorrencia<T, R>(
  items: T[],
  limite: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let proximoIndice = 0;

  async function worker(): Promise<void> {
    while (proximoIndice < items.length) {
      const indice = proximoIndice++;
      resultados[indice] = await fn(items[indice], indice);
    }
  }

  const workers = Array.from({ length: Math.min(limite, items.length) }, () => worker());
  await Promise.all(workers);
  return resultados;
}
