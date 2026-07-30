import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listProcessos, getProcesso, updateProcesso } from './actions';

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockOrder = vi.fn();
const mockOr = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ order: mockOrder, eq: mockEq, or: mockOr }));
const mockUpdateEq = vi.fn(() => ({ select: () => ({ single: mockSingle }) }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect, update: mockUpdate }),
  })),
}));

describe('listProcessos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the ordered list of processos', async () => {
    mockOrder.mockResolvedValue({ data: [{ id: 1, numero: 'P-1', autor: 'A', reu: 'B' }], error: null });
    const result = await listProcessos();
    expect(result).toEqual([{ id: 1, numero: 'P-1', autor: 'A', reu: 'B' }]);
  });
});

describe('listProcessos busca', () => {
  beforeEach(() => vi.clearAllMocks());

  const rows = [
    { id: 1, numero: 'P-1', autor: 'Ana Souza', reu: 'B' },
    { id: 2, numero: 'P-2', autor: 'André Costa', reu: 'C' },
  ];

  it('filters by numero/autor/reu when busca is provided', async () => {
    mockOrder.mockResolvedValue({ data: rows, error: null });
    const result = await listProcessos('Souza');
    expect(result).toEqual([rows[0]]);
  });

  it('matches accent-insensitively (e.g. "andre" matches "André")', async () => {
    mockOrder.mockResolvedValue({ data: rows, error: null });
    const result = await listProcessos('andre');
    expect(result).toEqual([rows[1]]);
  });

  it('does not filter when busca is empty', async () => {
    mockOrder.mockResolvedValue({ data: rows, error: null });
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
    const result = await updateProcesso(1, { numero: '', autor: 'A', reu: 'B' });
    expect(result).toEqual({ success: false, error: 'Número do processo é obrigatório' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates a valid processo', async () => {
    mockSingle.mockResolvedValue({ data: { id: 1, numero: 'P-2', autor: 'A', reu: 'B' }, error: null });
    const result = await updateProcesso(1, { numero: 'P-2', autor: 'A', reu: 'B' });
    expect(result).toEqual({ success: true, data: { id: 1, numero: 'P-2', autor: 'A', reu: 'B' } });
  });
});
