import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listColaboradores, deleteColaborador, mesclarColaboradores } from './actions';

const mockRange = vi.fn();
const mockOrder = vi.fn(() => ({ order: mockOrder, range: mockRange }));
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ order: mockOrder, eq: mockEq }));
const mockDeleteEq = vi.fn();
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));
const mockRpc = vi.fn();

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect, delete: mockDelete }),
    rpc: mockRpc,
  })),
}));

const rows = [
  { id: 1, nome: 'Bruna Souza', contato: '', formacao: '' },
  { id: 2, nome: 'José André', contato: '', formacao: '' },
];

describe('listColaboradores', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by nome when busca is provided', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listColaboradores('Bruna');
    expect(result).toEqual([rows[0]]);
  });

  it('matches accent-insensitively (e.g. "jose andre" matches "José André")', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listColaboradores('jose andre');
    expect(result).toEqual([rows[1]]);
  });

  it('does not filter when busca is empty', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listColaboradores();
    expect(result).toEqual(rows);
  });
});

describe('deleteColaborador', () => {
  beforeEach(() => {
    mockDeleteEq.mockReset();
    mockDeleteEq.mockReturnValue({ error: null });
  });

  it('deletes the colaborador', async () => {
    const result = await deleteColaborador(1);
    expect(result).toEqual({ success: true, data: null });
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 1);
  });

  it('returns the raw message on any database error', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '99999', message: 'boom' } });
    const result = await deleteColaborador(1);
    expect(result).toEqual({ success: false, error: 'boom' });
  });
});

describe('mesclarColaboradores', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockSingle.mockReset();
  });

  it('rejects when no loser ids are provided', async () => {
    const result = await mesclarColaboradores(1, [], { nome: 'Ana', contato: '', formacao: '', email: '' });
    expect(result).toEqual({ success: false, error: 'Selecione ao menos um colaborador para mesclar' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects when the survivor is also listed as a loser', async () => {
    const result = await mesclarColaboradores(1, [1, 2], { nome: 'Ana', contato: '', formacao: '', email: '' });
    expect(result).toEqual({ success: false, error: 'Selecione colaboradores diferentes para mesclar' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls the merge RPC with every loser id and returns the merged colaborador', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({
      data: { id: 1, nome: 'Ana Nova', contato: '', formacao: '', email: null }, error: null,
    });

    const result = await mesclarColaboradores(1, [2, 3], { nome: 'Ana Nova', contato: '', formacao: '', email: '' });

    expect(mockRpc).toHaveBeenCalledWith('merge_colaboradores', {
      survivor_id: 1, loser_ids: [2, 3],
      novo_nome: 'Ana Nova', novo_contato: '', nova_formacao: '', novo_email: null,
    });
    expect(result).toEqual({
      success: true, data: { id: 1, nome: 'Ana Nova', contato: '', formacao: '', email: null },
    });
  });

  it('returns the raw database error when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'conflito de horário' } });

    const result = await mesclarColaboradores(1, [2], { nome: 'Ana', contato: '', formacao: '', email: '' });

    expect(result).toEqual({ success: false, error: 'conflito de horário' });
  });
});
