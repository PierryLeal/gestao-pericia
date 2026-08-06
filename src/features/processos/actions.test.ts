import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listProcessos, getProcesso, updateProcesso, deleteProcesso, listEscritoriosDistintos } from './actions';

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockRange = vi.fn();
const mockOrder = vi.fn<(...args: unknown[]) => unknown>();
mockOrder.mockImplementation(() => ({ order: mockOrder, range: mockRange }));
const mockOr = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ order: mockOrder, eq: mockEq, or: mockOr }));
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
    const result = await listProcessos('Souza');
    expect(result).toEqual([rows[0]]);
  });

  it('matches accent-insensitively (e.g. "andre" matches "André")', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listProcessos('andre');
    expect(result).toEqual([rows[1]]);
  });

  it('does not filter when busca is empty', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listProcessos();
    expect(result).toEqual(rows);
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
  beforeEach(() => vi.clearAllMocks());

  it('returns the deduped, ordered list of escritorios', async () => {
    mockOrder.mockResolvedValue({
      data: [{ escritorio: 'PMRA' }, { escritorio: 'CESCON' }, { escritorio: 'PMRA' }],
      error: null,
    });
    const result = await listEscritoriosDistintos();
    expect(result).toEqual(['PMRA', 'CESCON']);
  });

  it('filters out empty-string values', async () => {
    mockOrder.mockResolvedValue({ data: [{ escritorio: '' }, { escritorio: 'PMRA' }], error: null });
    const result = await listEscritoriosDistintos();
    expect(result).toEqual(['PMRA']);
  });

  it('throws when the query returns an error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(listEscritoriosDistintos()).rejects.toThrow('boom');
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
