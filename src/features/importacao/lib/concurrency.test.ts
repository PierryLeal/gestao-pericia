import { describe, it, expect } from 'vitest';
import { mapComConcorrencia } from './concurrency';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('mapComConcorrencia', () => {
  it('returns results in the same order as the input, regardless of completion order', async () => {
    const itens = [30, 10, 20];
    const resultado = await mapComConcorrencia(itens, 3, async (ms) => {
      await delay(ms);
      return ms;
    });
    expect(resultado).toEqual([30, 10, 20]);
  });

  it('processes every item exactly once', async () => {
    const itens = Array.from({ length: 25 }, (_, i) => i);
    const vistos: number[] = [];
    await mapComConcorrencia(itens, 4, async (i) => {
      vistos.push(i);
      return i;
    });
    expect(vistos.sort((a, b) => a - b)).toEqual(itens);
  });

  it('never runs more than `limite` calls concurrently', async () => {
    const itens = Array.from({ length: 20 }, (_, i) => i);
    let emVoo = 0;
    let picoEmVoo = 0;
    await mapComConcorrencia(itens, 5, async () => {
      emVoo++;
      picoEmVoo = Math.max(picoEmVoo, emVoo);
      await delay(5);
      emVoo--;
    });
    expect(picoEmVoo).toBeLessThanOrEqual(5);
    expect(picoEmVoo).toBeGreaterThan(1); // sanity: it did run concurrently, not sequentially
  });

  it('works when the concurrency limit exceeds the item count', async () => {
    const resultado = await mapComConcorrencia([1, 2], 10, async (n) => n * 2);
    expect(resultado).toEqual([2, 4]);
  });

  it('returns an empty array for an empty input without hanging', async () => {
    const resultado = await mapComConcorrencia([], 5, async (n: number) => n);
    expect(resultado).toEqual([]);
  });

  it('propagates a rejection from fn', async () => {
    await expect(
      mapComConcorrencia([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('falhou');
        return n;
      })
    ).rejects.toThrow('falhou');
  });
});
