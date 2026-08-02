import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPericia, listPericias, updatePericia, deletePericia, getColaboradoresIndisponiveis } from './actions';

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockEq = vi.fn(() => ({ error: null }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockDeleteEq = vi.fn();
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));
const mockOrder = vi.fn<(...args: unknown[]) => unknown>(() => undefined);

// Captures every string passed to `.select()` on the `pericias` query
// builder, so tests can assert the embedded-resource join syntax actually
// used (e.g. `processos!inner` vs a plain, non-inner embed).
const periciasSelectCalls: string[] = [];
const periciasEqCalls: [string, unknown][] = [];
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
    order: mockOrder,
    eq: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([column, value]);
      return builder;
    }),
    filter: vi.fn(() => builder),
    gte: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([`gte:${column}`, value]);
      return builder;
    }),
    lte: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([`lte:${column}`, value]);
      return builder;
    }),
    not: vi.fn((column: string, operator: string, value: unknown) => {
      periciasEqCalls.push([`not:${column}:${operator}`, value]);
      return builder;
    }),
    neq: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([`neq:${column}`, value]);
      return builder;
    }),
    then: (resolve: (v: typeof periciasQueryResult) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(periciasQueryResult).then(resolve, reject),
  };
  mockOrder.mockImplementation(() => builder);
  return builder;
}

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ insert: mockInsert, update: mockUpdate, delete: mockDelete, ...periciasQueryBuilder() }),
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
  periciasEqCalls.length = 0;
  periciasQueryResult = { data: [], error: null };
  mockOrder.mockClear();
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

describe('deletePericia', () => {
  beforeEach(() => {
    mockDeleteEq.mockReset();
    mockDeleteEq.mockReturnValue({ error: null });
  });

  it('deletes the pericia', async () => {
    const result = await deletePericia(1);
    expect(result).toEqual({ success: true, data: null });
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 1);
  });

  it('returns the raw message on a database error', async () => {
    mockDeleteEq.mockReturnValue({ error: { message: 'boom' } });
    const result = await deletePericia(1);
    expect(result).toEqual({ success: false, error: 'boom' });
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

  it('filters by dataInicio using gte on data_agendada', async () => {
    await listPericias({ dataInicio: '2026-08-01' });
    expect(periciasEqCalls).toContainEqual(['gte:data_agendada', '2026-08-01']);
  });

  it('filters by dataFim using lte on data_agendada', async () => {
    await listPericias({ dataFim: '2026-08-10' });
    expect(periciasEqCalls).toContainEqual(['lte:data_agendada', '2026-08-10']);
  });

  it('filters an exact day when dataInicio equals dataFim', async () => {
    await listPericias({ dataInicio: '2026-08-05', dataFim: '2026-08-05' });
    expect(periciasEqCalls).toContainEqual(['gte:data_agendada', '2026-08-05']);
    expect(periciasEqCalls).toContainEqual(['lte:data_agendada', '2026-08-05']);
  });

  it('filters by municipioId when provided', async () => {
    await listPericias({ municipioId: 3550308 });
    expect(periciasEqCalls).toContainEqual(['municipio_id', 3550308]);
  });

  it('filters by peritoId when provided', async () => {
    await listPericias({ peritoId: 7 });
    expect(periciasEqCalls).toContainEqual(['perito_id', 7]);
  });

  it('filters by colaboradorId when provided', async () => {
    await listPericias({ colaboradorId: 3 });
    expect(periciasEqCalls).toContainEqual(['colaborador_id', 3]);
  });

  it('orders by data_agendada with nulls last', async () => {
    periciasQueryResult = { data: [], error: null };
    await listPericias();
    expect(mockOrder).toHaveBeenCalledWith('data_agendada', { ascending: false, nullsFirst: false });
  });
});

describe('getColaboradoresIndisponiveis', () => {
  it('returns the colaborador ids already booked at that exact date and time', async () => {
    periciasQueryResult = { data: [{ colaborador_id: 2 }, { colaborador_id: 5 }], error: null };

    const result = await getColaboradoresIndisponiveis('2026-08-10', '14:00');

    expect(result).toEqual([2, 5]);
    expect(periciasEqCalls).toContainEqual(['data_agendada', '2026-08-10']);
    expect(periciasEqCalls).toContainEqual(['hora_agendada', '14:00']);
    expect(periciasEqCalls).toContainEqual(['not:colaborador_id:is', null]);
  });

  it('excludes the given pericia id when editing', async () => {
    periciasQueryResult = { data: [], error: null };

    await getColaboradoresIndisponiveis('2026-08-10', '14:00', 7);

    expect(periciasEqCalls).toContainEqual(['neq:id', 7]);
  });

  it('does not filter by id when no exclude id is given', async () => {
    periciasQueryResult = { data: [], error: null };

    await getColaboradoresIndisponiveis('2026-08-10', '14:00');

    expect(periciasEqCalls.some(([col]) => col === 'neq:id')).toBe(false);
  });

  it('returns an empty array when nobody is booked', async () => {
    periciasQueryResult = { data: [], error: null };

    const result = await getColaboradoresIndisponiveis('2026-08-10', '14:00');

    expect(result).toEqual([]);
  });
});
