import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPericia, updatePericia } from './actions';

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockEq = vi.fn(() => ({ error: null }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ insert: mockInsert, update: mockUpdate }),
  })),
}));

const validInput = {
  processoId: 1,
  dataAgendada: '2026-08-01',
  horaAgendada: '14:30',
  municipioId: 3550308,
  peritoId: 1,
  colaboradorId: null,
  situacao: 'marcada' as const,
};

describe('createPericia', () => {
  beforeEach(() => {
    mockSingle.mockReset();
  });

  it('returns an error for invalid input without touching the database', async () => {
    const result = await createPericia({ ...validInput, processoId: 0 });
    expect(result).toEqual({ success: false, error: 'Selecione um processo' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('inserts a valid pericia and returns its id', async () => {
    mockSingle.mockResolvedValue({ data: { id: 10 }, error: null });
    const result = await createPericia(validInput);
    expect(result).toEqual({ success: true, data: { id: 10 } });
    expect(mockInsert).toHaveBeenCalledWith({
      processo_id: 1,
      data_agendada: '2026-08-01',
      hora_agendada: '14:30',
      municipio_id: 3550308,
      perito_id: 1,
      colaborador_id: null,
      situacao: 'marcada',
    });
  });
});

describe('updatePericia', () => {
  it('updates an existing pericia', async () => {
    const result = await updatePericia(10, validInput);
    expect(result).toEqual({ success: true, data: { id: 10 } });
    expect(mockUpdate).toHaveBeenCalled();
  });
});
