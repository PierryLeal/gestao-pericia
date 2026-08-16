import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listProcessos, getProcesso, updateProcesso, deleteProcesso, listEscritoriosDistintos, searchProcessos,
} from './actions';

const mockSingle = vi.fn();
const mockEq = vi.fn<(...args: unknown[]) => unknown>(() => ({ single: mockSingle }));
const mockRange = vi.fn();
// searchProcessos's chain (.not().order().limit()) reuses the same terminal
// mocks as listProcessos's (.order().range()) — only one of range()/limit()
// is ever called in a given test, so aliasing them is safe.
const mockOrder = vi.fn<(...args: unknown[]) => unknown>();
mockOrder.mockImplementation(() => ({ order: mockOrder, range: mockRange, limit: mockRange }));
const mockOr = vi.fn(() => ({ order: mockOrder }));
const mockNot = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ order: mockOrder, eq: mockEq, or: mockOr, not: mockNot }));
const mockUpdateEq = vi.fn(() => ({ select: () => ({ single: mockSingle }) }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockDeleteEq = vi.fn();
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect, update: mockUpdate, delete: mockDelete }),
  })),
}));

describe('listProcessos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockReturnValue({ order: mockOrder, range: mockRange });
  });

  it('returns the ordered list of processos', async () => {
    mockRange.mockResolvedValue({ data: [{ id: 1, numero: 'P-1', autor: 'A', reu: 'B' }], error: null });
    const result = await listProcessos();
    expect(result).toEqual([{ id: 1, numero: 'P-1', autor: 'A', reu: 'B' }]);
  });

  it('fetches via .range() (avoiding PostgREST\'s default row cap on an unbounded select)', async () => {
    mockRange.mockResolvedValue({ data: [{ id: 1, numero: 'P-1', autor: 'A', reu: 'B' }], error: null });
    await listProcessos();
    expect(mockRange).toHaveBeenCalledWith(0, 999);
  });
});

describe('listProcessos busca', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockReturnValue({ order: mockOrder, range: mockRange });
  });

  const rows = [
    { id: 1, numero: 'P-1', autor: 'Ana Souza', reu: 'B' },
    { id: 2, numero: 'P-2', autor: 'André Costa', reu: 'C' },
  ];

  it('filters by numero/autor/reu when busca is provided', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listProcessos({ busca: 'Souza' });
    expect(result).toEqual([rows[0]]);
  });

  it('matches accent-insensitively (e.g. "andre" matches "André")', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listProcessos({ busca: 'andre' });
    expect(result).toEqual([rows[1]]);
  });

  it('does not filter when busca is empty', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listProcessos();
    expect(result).toEqual(rows);
  });
});

describe('searchProcessos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockImplementation(() => ({ order: mockOrder, range: mockRange, limit: mockRange }));
  });

  it('excludes processos with an unidentified (provisório) número from the picker', async () => {
    mockRange.mockResolvedValue({ data: [{ id: 1, numero: 'P-1', autor: 'A', reu: 'B', escritorio: '' }], error: null });
    await searchProcessos('');
    expect(mockNot).toHaveBeenCalledWith('numero', 'like', '[SEM_NUMERO_IDENTIFICADO] %');
  });

  it('still returns the (already-filtered) results', async () => {
    mockRange.mockResolvedValue({ data: [{ id: 1, numero: 'P-1', autor: 'A', reu: 'B', escritorio: '' }], error: null });
    const result = await searchProcessos('');
    expect(result).toEqual([{ id: 1, numero: 'P-1', autor: 'A', reu: 'B', escritorio: '' }]);
  });
});

describe('getProcesso', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const result = await getProcesso(999);
    expect(result).toBeNull();
  });

  it('returns the processo when found', async () => {
    mockSingle.mockResolvedValue({ data: { id: 1, numero: 'P-1', autor: 'A', reu: 'B' }, error: null });
    const result = await getProcesso(1);
    expect(result).toEqual({ id: 1, numero: 'P-1', autor: 'A', reu: 'B' });
  });
});

describe('updateProcesso', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an error for invalid input without touching the database', async () => {
    const result = await updateProcesso(1, { numero: '', autor: 'A', reu: 'B', escritorio: 'PMRA' });
    expect(result).toEqual({ success: false, error: 'Número do processo é obrigatório' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('accepts a blank escritorio (optional field)', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 1, numero: 'P-1', autor: 'A', reu: 'B', escritorio: '' },
      error: null,
    });
    const result = await updateProcesso(1, { numero: 'P-1', autor: 'A', reu: 'B', escritorio: '' });
    expect(result).toEqual({
      success: true,
      data: { id: 1, numero: 'P-1', autor: 'A', reu: 'B', escritorio: '' },
    });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('updates a valid processo', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 1, numero: 'P-2', autor: 'A', reu: 'B', escritorio: 'PMRA' },
      error: null,
    });
    const result = await updateProcesso(1, { numero: 'P-2', autor: 'A', reu: 'B', escritorio: 'PMRA' });
    expect(result).toEqual({
      success: true,
      data: { id: 1, numero: 'P-2', autor: 'A', reu: 'B', escritorio: 'PMRA' },
    });
  });
});

describe('listEscritoriosDistintos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockReturnValue({ order: mockOrder, range: mockRange });
  });

  it('returns the deduped, ordered list of escritorios', async () => {
    mockRange.mockResolvedValue({
      data: [{ escritorio: 'PMRA' }, { escritorio: 'CESCON' }, { escritorio: 'PMRA' }],
      error: null,
    });
    const result = await listEscritoriosDistintos();
    expect(result).toEqual(['PMRA', 'CESCON']);
  });

  it('filters out empty-string values', async () => {
    mockRange.mockResolvedValue({ data: [{ escritorio: '' }, { escritorio: 'PMRA' }], error: null });
    const result = await listEscritoriosDistintos();
    expect(result).toEqual(['PMRA']);
  });

  it('throws when the query returns an error', async () => {
    mockRange.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(listEscritoriosDistintos()).rejects.toThrow('boom');
  });

  // Regression: an unbounded .select() silently truncates at PostgREST's
  // 1000-row cap — confirmed live, this is exactly what made every real
  // escritório invisible when most rows sorted ahead of them were blank.
  it('pages through more than 1000 rows instead of stopping at the first page', async () => {
    const primeiraPagina = Array.from({ length: 1000 }, () => ({ escritorio: '' }));
    const segundaPagina = [{ escritorio: 'PMRA' }, ...Array.from({ length: 3 }, () => ({ escritorio: '' }))];
    mockRange
      .mockResolvedValueOnce({ data: primeiraPagina, error: null })
      .mockResolvedValueOnce({ data: segundaPagina, error: null });

    const result = await listEscritoriosDistintos();

    expect(result).toEqual(['PMRA']);
    expect(mockRange).toHaveBeenCalledTimes(2);
    expect(mockRange).toHaveBeenNthCalledWith(1, 0, 999);
    expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});

describe('deleteProcesso', () => {
  beforeEach(() => {
    mockDeleteEq.mockReset();
    mockDeleteEq.mockReturnValue({ error: null });
  });

  it('deletes the processo', async () => {
    const result = await deleteProcesso(1);
    expect(result).toEqual({ success: true, data: null });
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 1);
  });

  it('returns a friendly error when the processo has linked pericias', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '23503', message: 'foreign key violation' } });
    const result = await deleteProcesso(1);
    expect(result).toEqual({
      success: false,
      error: 'Não é possível excluir: há perícias vinculadas a este processo.',
    });
  });
});
