import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPericia, listPericias, updatePericia, deletePericia, getColaboradoresIndisponiveis,
  listPericiasPorColaboradorIds, listPericiasPorPeritoIds, listContratosDistintos,
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

// listPericias's busca filter resolves matching processo ids from `processos`
// up front (see actions.ts) — a separate table/state from the main pericias query.
const processosOrCalls: [string, unknown][] = [];
let processosResult: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

function processosQueryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    or: vi.fn((filters: string) => {
      processosOrCalls.push([filters, undefined]);
      return builder;
    }),
    then: (resolve: (v: typeof processosResult) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(processosResult).then(resolve, reject),
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
        : table === 'processos'
          ? processosQueryBuilder()
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
  contrato: null,
  local: null,
};

beforeEach(() => {
  periciasSelectCalls.length = 0;
  periciasEqCalls.length = 0;
  periciasQueryResult = { data: [], error: null };
  periciaColaboradoresEqCalls.length = 0;
  periciaColaboradoresResult = { data: [], error: null };
  processosOrCalls.length = 0;
  processosResult = { data: [], error: null };
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
      p_colaborador_ids: [], p_contrato: null, p_local: null,
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
      p_colaborador_ids: [], p_contrato: null, p_local: null,
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
    contrato: 'VALE AT',
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

  it('uses plain (non-inner) embeds so a pericia missing processo/município/perito still lists', async () => {
    periciasQueryResult = { data: [], error: null };
    await listPericias({});

    expect(periciasSelectCalls.length).toBeGreaterThan(0);
    const selectArg = periciasSelectCalls[0];
    expect(selectArg).not.toContain('processos!inner');
    expect(selectArg).not.toContain('municipios!inner');
    expect(selectArg).not.toContain('peritos!inner');
    expect(selectArg).not.toContain('colaboradores!inner');
  });

  it('searches busca across numero, autor and reu by resolving matching processo ids first, then filtering pericias by processo_id', async () => {
    // A plain (non-`!inner`) embed doesn't drop top-level rows when filtered —
    // even via `.or(..., { referencedTable })` — it just nulls the embedded
    // object, so busca must narrow the query via a real column (processo_id),
    // not a filter on the embedded processo.
    processosResult = { data: [{ id: 5 }, { id: 6 }], error: null };
    periciasQueryResult = { data: [], error: null };

    await listPericias({ busca: 'Souza' });

    expect(processosOrCalls).toEqual([
      ['numero.ilike."%Souza%",autor.ilike."%Souza%",reu.ilike."%Souza%"', undefined],
    ]);
    expect(periciasEqCalls).toContainEqual(['in:processo_id', [5, 6]]);
  });

  it('returns no rows without querying pericias when no processo matches the busca term', async () => {
    processosResult = { data: [], error: null };

    const result = await listPericias({ busca: 'ninguém encontrado' });

    expect(result).toEqual([]);
    expect(periciasEqCalls).toEqual([]);
  });

  it('does not apply the busca filter when it is empty', async () => {
    periciasQueryResult = { data: [], error: null };
    await listPericias({});

    expect(processosOrCalls).toEqual([]);
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
        contrato: 'VALE AT',
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
        problemas: [],
      },
    ]);
  });

  it('flags problemas for a row missing processo, município, or perito', async () => {
    periciasQueryResult = {
      data: [{ ...fullRow, processo: null, municipio: null, perito: null }],
      error: null,
    };
    periciaColaboradoresResult = { data: [], error: null };

    const result = await listPericias();

    expect(result[0].problemas).toEqual(['processo não vinculado', 'município não vinculado', 'perito não vinculado']);
  });

  it('flags a colaborador whose name is a single character as a problema', async () => {
    periciasQueryResult = { data: [fullRow], error: null };
    periciaColaboradoresResult = {
      data: [{ pericia_id: 1, colaborador: { id: 3, nome: 'J', contato: '', formacao: '' } }],
      error: null,
    };

    const result = await listPericias();

    expect(result[0].problemas).toEqual(['colaborador "J" com nome muito curto']);
  });

  it('does not flag a colaborador with a short but plausible name (2+ characters)', async () => {
    periciasQueryResult = { data: [fullRow], error: null };
    periciaColaboradoresResult = {
      data: [{ pericia_id: 1, colaborador: { id: 3, nome: 'Jó', contato: '', formacao: '' } }],
      error: null,
    };

    const result = await listPericias();

    expect(result[0].problemas).toEqual([]);
  });

  it('filters by contrato directly on the pericias column', async () => {
    // contrato lives on pericias now — a processo can legitimately be worked
    // under more than one contrato over time (confirmed in a real import: the
    // same processo appeared under two different contrato blocks), so it can
    // no longer be resolved through the processo relationship.
    periciasQueryResult = { data: [], error: null };

    await listPericias({ contrato: 'VALE AT' });

    expect(periciasEqCalls).toContainEqual(['contrato', 'VALE AT']);
  });

  it('does not apply the contrato filter when it is empty', async () => {
    periciasQueryResult = { data: [], error: null };

    await listPericias({});

    expect(periciasEqCalls).toEqual([]);
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

  it('chunks a large colaboradorId result into multiple .in(id) calls instead of one giant list (URL/header size limit)', async () => {
    const muitosIds = Array.from({ length: 1200 }, (_, i) => ({ pericia_id: i + 1 }));
    periciaColaboradoresResult = { data: muitosIds, error: null };
    periciasQueryResult = { data: [], error: null };

    await listPericias({ colaboradorId: 3 });

    const chamadasIn = periciasEqCalls.filter(([col]) => col === 'in:id');
    expect(chamadasIn.length).toBeGreaterThan(1);
    for (const [, valores] of chamadasIn) {
      expect((valores as number[]).length).toBeLessThanOrEqual(500);
    }
    const totalIds = chamadasIn.reduce((soma, [, valores]) => soma + (valores as number[]).length, 0);
    expect(totalIds).toBe(1200);
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

  it('excludes pericias sharing the same perito and local (understood as sequential work, not a conflict)', async () => {
    periciasQueryResult = {
      data: [
        { id: 7, processo_id: 1, perito_id: 3, local: 'CMD' },
        { id: 9, processo_id: 2, perito_id: 3, local: 'CMD' },
      ],
      error: null,
    };
    await getColaboradoresIndisponiveis('2026-08-10', '14:00', undefined, undefined, 3, 'CMD');
    expect(periciaColaboradoresEqCalls.some(([col]) => col === 'in:pericia_id')).toBe(false);
  });

  it('matches local case/accent-insensitively', async () => {
    periciasQueryResult = {
      data: [{ id: 7, processo_id: 1, perito_id: 3, local: 'cmd' }],
      error: null,
    };
    await getColaboradoresIndisponiveis('2026-08-10', '14:00', undefined, undefined, 3, 'CMD');
    expect(periciaColaboradoresEqCalls.some(([col]) => col === 'in:pericia_id')).toBe(false);
  });

  it('still checks pericias whose perito differs, even with the same local', async () => {
    periciasQueryResult = {
      data: [{ id: 7, processo_id: 1, perito_id: 99, local: 'CMD' }],
      error: null,
    };
    await getColaboradoresIndisponiveis('2026-08-10', '14:00', undefined, undefined, 3, 'CMD');
    expect(periciaColaboradoresEqCalls).toContainEqual(['in:pericia_id', [7]]);
  });

  it('still checks pericias whose local differs, even with the same perito', async () => {
    periciasQueryResult = {
      data: [{ id: 7, processo_id: 1, perito_id: 3, local: 'Outro Local' }],
      error: null,
    };
    await getColaboradoresIndisponiveis('2026-08-10', '14:00', undefined, undefined, 3, 'CMD');
    expect(periciaColaboradoresEqCalls).toContainEqual(['in:pericia_id', [7]]);
  });

  it('does not apply the perito+local exemption when only one of them is provided', async () => {
    periciasQueryResult = {
      data: [{ id: 7, processo_id: 1, perito_id: 3, local: 'CMD' }],
      error: null,
    };
    await getColaboradoresIndisponiveis('2026-08-10', '14:00', undefined, undefined, 3, undefined);
    expect(periciaColaboradoresEqCalls).toContainEqual(['in:pericia_id', [7]]);
  });

  it('does not apply the exemption when local is blank', async () => {
    periciasQueryResult = {
      data: [{ id: 7, processo_id: 1, perito_id: 3, local: 'CMD' }],
      error: null,
    };
    await getColaboradoresIndisponiveis('2026-08-10', '14:00', undefined, undefined, 3, '   ');
    expect(periciaColaboradoresEqCalls).toContainEqual(['in:pericia_id', [7]]);
  });

  it('returns an empty array without querying anything when the pericia itself is cancelada', async () => {
    // A cancelada pericia doesn't occupy the colaborador's time at all — it's
    // not going to happen — so nothing can conflict with it.
    const result = await getColaboradoresIndisponiveis('2026-08-10', '14:00', undefined, undefined, undefined, undefined, 'cancelada');
    expect(result).toEqual([]);
    expect(periciasEqCalls).toEqual([]);
  });

  it('excludes cancelada pericias from the slot query — they never count as busy', async () => {
    periciasQueryResult = { data: [{ id: 7, processo_id: 1 }], error: null };
    await getColaboradoresIndisponiveis('2026-08-10', '14:00');
    expect(periciasEqCalls).toContainEqual(['neq:situacao', 'cancelada']);
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

describe('listContratosDistintos', () => {
  it('returns the deduped, ordered list of contratos', async () => {
    periciasQueryResult = {
      data: [{ contrato: 'VALE AT' }, { contrato: 'ANGLO' }, { contrato: 'VALE AT' }],
      error: null,
    };
    const result = await listContratosDistintos();
    expect(result).toEqual(['VALE AT', 'ANGLO']);
  });

  it('filters out null values', async () => {
    periciasQueryResult = { data: [{ contrato: null }, { contrato: 'VALE AT' }], error: null };
    const result = await listContratosDistintos();
    expect(result).toEqual(['VALE AT']);
  });

  it('throws when the query returns an error', async () => {
    periciasQueryResult = { data: null, error: { message: 'boom' } };
    await expect(listContratosDistintos()).rejects.toThrow('boom');
  });
});
