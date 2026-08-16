import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPeritos, listPeritosOptions, deletePerito, mesclarPeritos } from './actions';

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
  {
    id: 1, nome: 'Carlos Lima', contato: '', formacao: '', crea: '', documento: '',
    ja_trabalhamos: false, relacao: 'neutra' as const, resultados: 'parcial' as const,
  },
  {
    id: 2, nome: 'André Simões', contato: '', formacao: '', crea: '', documento: '',
    ja_trabalhamos: false, relacao: 'neutra' as const, resultados: 'parcial' as const,
  },
];

describe('listPeritos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by nome when busca is provided', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listPeritos('Carlos');
    expect(result.map((p) => p.id)).toEqual([1]);
  });

  it('matches accent-insensitively (e.g. "andre" matches "André")', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listPeritos('andre');
    expect(result.map((p) => p.id)).toEqual([2]);
  });

  it('does not filter when busca is empty', async () => {
    mockRange.mockResolvedValue({ data: rows, error: null });
    const result = await listPeritos();
    expect(result.map((p) => p.id)).toEqual([1, 2]);
  });
});

describe('listPeritosOptions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns id/nome for every perito', async () => {
    mockRange.mockResolvedValue({ data: [{ id: 1, nome: 'Carlos Lima' }, { id: 2, nome: 'André Simões' }], error: null });
    const result = await listPeritosOptions();
    expect(result).toEqual([{ id: 1, nome: 'Carlos Lima' }, { id: 2, nome: 'André Simões' }]);
  });

  // Regression: an unbounded .select() silently truncates at PostgREST's
  // 1000-row cap (confirmed live on a sibling function) — this must page
  // through .range() to see every perito once the table grows past it.
  it('pages through more than 1000 rows instead of stopping at the first page', async () => {
    const primeiraPagina = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, nome: `P${i + 1}` }));
    const segundaPagina = [{ id: 1001, nome: 'Último' }];
    mockRange
      .mockResolvedValueOnce({ data: primeiraPagina, error: null })
      .mockResolvedValueOnce({ data: segundaPagina, error: null });
    const result = await listPeritosOptions();
    expect(result).toHaveLength(1001);
    expect(mockRange).toHaveBeenCalledTimes(2);
  });
});

describe('deletePerito', () => {
  beforeEach(() => {
    mockDeleteEq.mockReset();
    mockDeleteEq.mockReturnValue({ error: null });
  });

  it('deletes the perito', async () => {
    const result = await deletePerito(1);
    expect(result).toEqual({ success: true, data: null });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 1);
  });

  it('returns a friendly error when the perito has linked pericias', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '23503', message: 'foreign key violation' } });
    const result = await deletePerito(1);
    expect(result).toEqual({
      success: false,
      error: 'Não é possível excluir: há perícias vinculadas a este perito.',
    });
  });

  it('returns the raw message for any other error', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '99999', message: 'boom' } });
    const result = await deletePerito(1);
    expect(result).toEqual({ success: false, error: 'boom' });
  });
});

const inputBase = {
  nome: 'Carlos', contato: '', formacao: '', crea: '', documento: '',
  jaTrabalhamos: false, relacao: 'neutra' as const, resultados: 'parcial' as const,
};

describe('mesclarPeritos', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockSingle.mockReset();
  });

  it('rejects when no loser ids are provided', async () => {
    const result = await mesclarPeritos(1, [], inputBase);
    expect(result).toEqual({ success: false, error: 'Selecione ao menos um perito para mesclar' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects when the survivor is also listed as a loser', async () => {
    const result = await mesclarPeritos(1, [1, 2], inputBase);
    expect(result).toEqual({ success: false, error: 'Selecione peritos diferentes para mesclar' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls the merge RPC with every loser id and returns the merged perito', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({
      data: {
        id: 1, nome: 'Carlos', contato: '', formacao: 'Eng. Civil', crea: 'CREA-1', documento: '',
        ja_trabalhamos: true, relacao: 'boa', resultados: 'positivo',
      },
      error: null,
    });

    const result = await mesclarPeritos(1, [2, 3], {
      ...inputBase, formacao: 'Eng. Civil', crea: 'CREA-1', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    });

    expect(mockRpc).toHaveBeenCalledWith('merge_peritos', {
      survivor_id: 1, loser_ids: [2, 3],
      novo_nome: 'Carlos', novo_contato: '', nova_formacao: 'Eng. Civil', novo_crea: 'CREA-1',
      novo_documento: '', novo_ja_trabalhamos: true, nova_relacao: 'boa', novo_resultados: 'positivo',
    });
    expect(result).toEqual({
      success: true,
      data: {
        id: 1, nome: 'Carlos', contato: '', formacao: 'Eng. Civil', crea: 'CREA-1', documento: '',
        jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
      },
    });
  });

  it('returns the raw database error when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'conflito' } });
    const result = await mesclarPeritos(1, [2], inputBase);
    expect(result).toEqual({ success: false, error: 'conflito' });
  });
});
