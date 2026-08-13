import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPericia, listPericias, updatePericia, deletePericia, getColaboradoresIndisponiveis,
  listPericiasPorColaboradorIds, listPericiasPorPeritoIds,
} from './actions';

const mockRpc = vi.fn();
const mockDeleteEq = vi.fn();
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));
const mockOrder = vi.fn<(...args: unknown[]) => unknown>(() => undefined);

// Captures every string passed to `.select()` on the `pericias` query
// builder, so tests can assert the embedded-resource join syntax actually
// used (e.g. `processos!inner` vs a plain, non-inner embed).
const periciasSelectCalls: string[] = [];
const periciasEqCalls: [string, unknown][] = [];
const periciasOrCalls: [string, unknown][] = [];
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
    or: vi.fn((filters: string, options: unknown) => {
      periciasOrCalls.push([filters, options]);
      return builder;
    }),
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
    in: vi.fn((column: string, values: unknown) => {
      periciasEqCalls.push([`in:${column}`, values]);
      return builder;
    }),
    range: vi.fn(() => builder),
    then: (resolve: (v: typeof periciasQueryResult) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(periciasQueryResult).then(resolve, reject),
  };
  mockOrder.mockImplementation(() => builder);
  return builder;
}

// `pericia_colaboradores` is a separate table now (the many-to-many join),
// queried directly by getColaboradoresIndisponiveis, listPericiasPorColaboradorIds,
// and listPericias's colaboradorId pre-query.
const periciaColaboradoresEqCalls: [string, unknown][] = [];
let periciaColaboradoresResult: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

function periciaColaboradoresQueryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      periciaColaboradoresEqCalls.push([column, value]);
      return builder;
    }),
    neq: vi.fn((column: string, value: unknown) => {
      periciaColaboradoresEqCalls.push([`neq:${column}`, value]);
      return builder;
    }),
    in: vi.fn((column: string, values: unknown) => {
      periciaColaboradoresEqCalls.push([`in:${column}`, values]);
      return builder;
    }),
    range: vi.fn(() => builder),
    then: (resolve: (v: typeof periciaColaboradoresResult) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(periciaColaboradoresResult).then(resolve, reject),
  };
  return builder;
}

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) =>
      table === 'pericia_colaboradores'
        ? periciaColaboradoresQueryBuilder()
        : { delete: mockDelete, ...periciasQueryBuilder() },
    rpc: mockRpc,
  })),
}));

const validInput = {
  processoId: 1,
  dataAgendada: '2026-08-01',
  horaAgendada: '14:30',
  municipioId: 3550308,
  peritoId: 1,
  colaboradorIds: [] as number[],
  situacao: 'marcada' as const,
  observacoes: null,
};

beforeEach(() => {
  periciasSelectCalls.length = 0;
  periciasEqCalls.length = 0;
  periciasOrCalls.length = 0;
  periciasQueryResult = { data: [], error: null };
  periciaColaboradoresEqCalls.length = 0;
  periciaColaboradoresResult = { data: [], error: null };
  mockOrder.mockClear();
  mockRpc.mockReset();
});

describe('createPericia', () => {
  it('returns an error for invalid input without touching the database', async () => {
    const result = await createPericia({ ...validInput, processoId: 0 });
    expect(result).toEqual({ success: false, error: 'Selecione um processo' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('creates a valid pericia via the combined RPC and returns its id', async () => {
    mockRpc.mockResolvedValue({ data: 10, error: null });
    const result = await createPericia(validInput);
    expect(result).toEqual({ success: true, data: { id: 10 } });
    expect(mockRpc).toHaveBeenCalledWith('create_pericia_with_colaboradores', {
      p_processo_id: 1, p_data_agendada: '2026-08-01', p_hora_agendada: '14:30',
      p_municipio_id: 3550308, p_perito_id: 1, p_situacao: 'marcada', p_observacoes: null,
      p_colaborador_ids: [],
    });
  });

  it('passes every selected colaborador id through to the RPC', async () => {
    mockRpc.mockResolvedValue({ data: 10, error: null });
    await createPericia({ ...validInput, colaboradorIds: [3, 4] });
    expect(mockRpc).toHaveBeenCalledWith(
      'create_pericia_with_colaboradores',
      expect.objectContaining({ p_colaborador_ids: [3, 4] })
    );
  });

  it('returns a friendly error when a colaborador is already booked at that date/time', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'colaborador já está em outra perícia nesse mesmo dia e horário' },
    });
    const result = await createPericia(validInput);
    expect(result).toEqual({
      success: false,
      error: 'Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.',
    });
  });
});

describe('updatePericia', () => {
  it('updates an existing pericia via the combined RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const result = await updatePericia(10, validInput);
    expect(result).toEqual({ success: true, data: { id: 10 } });
    expect(mockRpc).toHaveBeenCalledWith('update_pericia_with_colaboradores', {
      p_id: 10, p_processo_id: 1, p_data_agendada: '2026-08-01', p_hora_agendada: '14:30',
      p_municipio_id: 3550308, p_perito_id: 1, p_situacao: 'marcada', p_observacoes: null,
      p_colaborador_ids: [],
    });
  });

  it('returns a friendly error when a colaborador is already booked at that date/time', async () => {
    mockRpc.mockResolvedValue({
      error: { code: '23505', message: 'colaborador já está em outra perícia nesse mesmo dia e horário' },
    });
    const result = await updatePericia(10, validInput);
    expect(result).toEqual({
      success: false,
      error: 'Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.',
    });
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
    observacoes: 'Levar equipamento extra',
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
  };

  it('uses inner joins for the required (non-nullable) embedded relations when searching', async () => {
    periciasQueryResult = { data: [], error: null };
    await listPericias({ busca: 'x' });

    expect(periciasSelectCalls.length).toBeGreaterThan(0);
    const selectArg = periciasSelectCalls[0];
    expect(selectArg).toContain('processos!inner');
    expect(selectArg).toContain('municipios!inner');
    expect(selectArg).toContain('peritos!inner');
    // colaboradores are zero-or-many (via pericia_colaboradores) and must stay a left join.
    expect(selectArg).not.toContain('colaboradores!inner');
  });

  it('searches busca across numero, autor and reu on the embedded processo', async () => {
    periciasQueryResult = { data: [], error: null };
    await listPericias({ busca: 'Souza' });

    expect(periciasOrCalls).toEqual([
      ['numero.ilike."%Souza%",autor.ilike."%Souza%",reu.ilike."%Souza%"', { referencedTable: 'processo' }],
    ]);
  });

  it('does not apply the busca filter when it is empty', async () => {
    periciasQueryResult = { data: [], error: null };
    await listPericias({});

    expect(periciasOrCalls).toEqual([]);
  });

  it('maps a full row with all embeds present without throwing', async () => {
    periciasQueryResult = { data: [fullRow], error: null };
    periciaColaboradoresResult = {
      data: [{ pericia_id: 1, colaborador: { id: 3, nome: 'Colaborador W', contato: '(11) 98888-0000', formacao: 'Direito' } }],
      error: null,
    };

    const result = await listPericias();

    expect(result).toEqual([
      {
        id: 1,
        dataAgendada: '2026-08-01',
        horaAgendada: '14:30',
        situacao: 'marcada',
        observacoes: 'Levar equipamento extra',
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
        colaboradores: [
          { id: 3, nome: 'Colaborador W', contato: '(11) 98888-0000', formacao: 'Direito' },
        ],
      },
    ]);
  });

  it('maps a row with no colaboradores to an empty array', async () => {
    periciasQueryResult = { data: [fullRow], error: null };
    periciaColaboradoresResult = { data: [], error: null };

    const result = await listPericias();

    expect(result[0].colaboradores).toEqual([]);
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

  it('filters by colaboradorId via a pre-query on pericia_colaboradores, then .in(id) on pericias', async () => {
    periciaColaboradoresResult = { data: [{ pericia_id: 42 }], error: null };
    periciasQueryResult = { data: [], error: null };

    await listPericias({ colaboradorId: 3 });

    expect(periciaColaboradoresEqCalls).toContainEqual(['colaborador_id', 3]);
    expect(periciasEqCalls).toContainEqual(['in:id', [42]]);
  });

  it('returns an empty array without querying pericias when colaboradorId matches nothing', async () => {
    periciaColaboradoresResult = { data: [], error: null };

    const result = await listPericias({ colaboradorId: 3 });

    expect(result).toEqual([]);
    expect(periciasSelectCalls).toEqual([]);
  });

  it('orders by data_agendada with nulls last', async () => {
    periciasQueryResult = { data: [], error: null };
    await listPericias();
    expect(mockOrder).toHaveBeenCalledWith('data_agendada', { ascending: false, nullsFirst: false });
  });
});

describe('getColaboradoresIndisponiveis', () => {
  it('returns the colaborador ids already booked at that exact date and time', async () => {
    periciasQueryResult = { data: [{ id: 100, processo_id: 1 }], error: null };
    periciaColaboradoresResult = { data: [{ colaborador_id: 2 }, { colaborador_id: 5 }], error: null };

    const result = await getColaboradoresIndisponiveis('2026-08-10', '14:00');

    expect(result).toEqual([2, 5]);
    expect(periciasEqCalls).toContainEqual(['data_agendada', '2026-08-10']);
    expect(periciasEqCalls).toContainEqual(['hora_agendada', '14:00']);
  });

  it('excludes the given pericia id when editing', async () => {
    periciasQueryResult = { data: [{ id: 7, processo_id: 1 }, { id: 9, processo_id: 2 }], error: null };
    await getColaboradoresIndisponiveis('2026-08-10', '14:00', undefined, 7);
    expect(periciaColaboradoresEqCalls).toContainEqual(['in:pericia_id', [9]]);
  });

  it('does not filter by pericia id when no exclude id is given', async () => {
    periciasQueryResult = { data: [{ id: 7, processo_id: 1 }], error: null };
    await getColaboradoresIndisponiveis('2026-08-10', '14:00');
    expect(periciaColaboradoresEqCalls).toContainEqual(['in:pericia_id', [7]]);
  });

  it('excludes pericias for the same processo when a processoId is given', async () => {
    await getColaboradoresIndisponiveis('2026-08-10', '14:00', 5);
    expect(periciasEqCalls).toContainEqual(['neq:processo_id', 5]);
  });

  it('does not filter by processo when no processoId is given', async () => {
    await getColaboradoresIndisponiveis('2026-08-10', '14:00');
    expect(periciasEqCalls.some(([col]) => col === 'neq:processo_id')).toBe(false);
  });

  it('returns an empty array when nobody is booked', async () => {
    const result = await getColaboradoresIndisponiveis('2026-08-10', '14:00');
    expect(result).toEqual([]);
  });
});

describe('listPericiasPorColaboradorIds', () => {
  it('returns an empty array without querying when no ids are given', async () => {
    const result = await listPericiasPorColaboradorIds([]);
    expect(result).toEqual([]);
    expect(periciaColaboradoresEqCalls.some(([col]) => col === 'in:colaborador_id')).toBe(false);
  });

  it('queries pericia_colaboradores by colaborador_id and maps each row to a resumo', async () => {
    periciaColaboradoresResult = {
      data: [{ pericia_id: 10, colaborador: { nome: 'João 2' } }],
      error: null,
    };
    periciasQueryResult = {
      data: [{
        id: 10, data_agendada: '2026-08-10', hora_agendada: '09:00:00', situacao: 'marcada',
        processo: { numero: '0001234-56.2026' },
      }],
      error: null,
    };

    const result = await listPericiasPorColaboradorIds([2, 3]);

    expect(periciaColaboradoresEqCalls).toContainEqual(['in:colaborador_id', [2, 3]]);
    expect(result).toEqual([{
      id: 10, processoNumero: '0001234-56.2026', dataAgendada: '2026-08-10',
      horaAgendada: '09:00:00', situacao: 'marcada', donoAtual: 'João 2',
    }]);
  });

  it('produces one row per (pericia, colaborador) pair when a pericia has an unrelated second colaborador', async () => {
    // Only the loser's own link shows up here — the pericia's other,
    // untouched colaborador never appears in this query's result at all.
    periciaColaboradoresResult = {
      data: [{ pericia_id: 10, colaborador: { nome: 'Perdedor' } }],
      error: null,
    };
    periciasQueryResult = {
      data: [{
        id: 10, data_agendada: '2026-08-10', hora_agendada: '09:00:00', situacao: 'marcada',
        processo: { numero: '0001234-56.2026' },
      }],
      error: null,
    };

    const result = await listPericiasPorColaboradorIds([2]);

    expect(result).toHaveLength(1);
    expect(result[0].donoAtual).toBe('Perdedor');
  });
});

describe('listPericiasPorPeritoIds', () => {
  it('returns an empty array without querying when no ids are given', async () => {
    const result = await listPericiasPorPeritoIds([]);
    expect(result).toEqual([]);
    expect(periciasEqCalls.some(([col]) => col === 'in:perito_id')).toBe(false);
  });

  it('queries by perito_id and maps each row to a resumo', async () => {
    periciasQueryResult = {
      data: [{
        id: 20, data_agendada: '2026-09-01', hora_agendada: '14:00:00', situacao: 'pendente',
        processo: { numero: '0009876-12.2026' }, perito: { nome: 'Carlos 2' },
      }],
      error: null,
    };

    const result = await listPericiasPorPeritoIds([2]);

    expect(periciasEqCalls).toContainEqual(['in:perito_id', [2]]);
    expect(result).toEqual([{
      id: 20, processoNumero: '0009876-12.2026', dataAgendada: '2026-09-01',
      horaAgendada: '14:00:00', situacao: 'pendente', donoAtual: 'Carlos 2',
    }]);
  });
});
