import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPericia, listPericias, updatePericia } from './actions';

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockEq = vi.fn(() => ({ error: null }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));

// Captures every string passed to `.select()` on the `pericias` query
// builder, so tests can assert the embedded-resource join syntax actually
// used (e.g. `processos!inner` vs a plain, non-inner embed).
const periciasSelectCalls: string[] = [];
let periciasQueryResult: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

function periciasQueryBuilder() {
  const builder = {
    select: vi.fn((arg: string) => {
      periciasSelectCalls.push(arg);
      return builder;
    }),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    filter: vi.fn(() => builder),
    then: (resolve: (v: typeof periciasQueryResult) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(periciasQueryResult).then(resolve, reject),
  };
  return builder;
}

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ insert: mockInsert, update: mockUpdate, ...periciasQueryBuilder() }),
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

beforeEach(() => {
  periciasSelectCalls.length = 0;
  periciasQueryResult = { data: [], error: null };
});

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

describe('listPericias', () => {
  const fullRow = {
    id: 1,
    data_agendada: '2026-08-01',
    hora_agendada: '14:30',
    situacao: 'marcada',
    processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y' },
    municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
    perito: {
      id: 2,
      nome: 'Perito Z',
      contato: '(11) 99999-0000',
      formacao: 'Engenharia',
      crea: 'CREA-123',
      ja_trabalhamos: true,
      relacao: 8,
      resultados: 9,
    },
    colaborador: {
      id: 3,
      nome: 'Colaborador W',
      contato: '(11) 98888-0000',
      formacao: 'Direito',
      interno: true,
    },
  };

  it('uses inner joins for the required (non-nullable) embedded relations when searching', async () => {
    periciasQueryResult = { data: [], error: null };
    await listPericias({ busca: 'x' });

    expect(periciasSelectCalls.length).toBeGreaterThan(0);
    const selectArg = periciasSelectCalls[0];
    expect(selectArg).toContain('processos!inner');
    expect(selectArg).toContain('municipios!inner');
    expect(selectArg).toContain('peritos!inner');
    // colaborador is nullable (ON DELETE SET NULL) and must stay a left join.
    expect(selectArg).not.toContain('colaboradores!inner');
  });

  it('maps a full row with all embeds present without throwing', async () => {
    periciasQueryResult = { data: [fullRow], error: null };

    const result = await listPericias();

    expect(result).toEqual([
      {
        id: 1,
        dataAgendada: '2026-08-01',
        horaAgendada: '14:30',
        situacao: 'marcada',
        processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y' },
        municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
        perito: {
          id: 2,
          nome: 'Perito Z',
          contato: '(11) 99999-0000',
          formacao: 'Engenharia',
          crea: 'CREA-123',
          jaTrabalhamos: true,
          relacao: 8,
          resultados: 9,
        },
        colaborador: {
          id: 3,
          nome: 'Colaborador W',
          contato: '(11) 98888-0000',
          formacao: 'Direito',
          interno: true,
        },
      },
    ]);
  });
});
