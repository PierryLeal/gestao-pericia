import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { previewImportacaoPericias, confirmarImportacaoPericias } from './actions';
import { previewImportacaoPeritosColaboradores, confirmarImportacaoPeritosColaboradores } from './actions';
import { marcarNumeroProvisorio } from '@/lib/processo-numero-provisorio';
import type { PericiaPreviewRow, ColaboradorPreviewRow, PeritoPreviewRow } from './types';

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

const mockListPeritos = vi.fn();
const mockListColaboradores = vi.fn();
const mockListProcessos = vi.fn();
const mockListPericias = vi.fn();
const mockFindMunicipiosPorNomeExato = vi.fn();
const mockUpsertMunicipio = vi.fn();
const mockCreateProcesso = vi.fn();
const mockUpdateProcesso = vi.fn();
const mockCreatePerito = vi.fn();
const mockUpdatePerito = vi.fn();
const mockCreateColaborador = vi.fn();
const mockUpdateColaborador = vi.fn();
const mockCreatePericiaComPendencias = vi.fn();

vi.mock('@/features/processos/actions', () => ({
  listProcessos: (...args: unknown[]) => mockListProcessos(...args),
  createProcessoComPendencias: (...args: unknown[]) => mockCreateProcesso(...args),
  updateProcessoComPendencias: (...args: unknown[]) => mockUpdateProcesso(...args),
}));
vi.mock('@/features/peritos/actions', () => ({
  listPeritos: (...args: unknown[]) => mockListPeritos(...args),
  createPerito: (...args: unknown[]) => mockCreatePerito(...args),
  updatePerito: (...args: unknown[]) => mockUpdatePerito(...args),
}));
vi.mock('@/features/colaboradores/actions', () => ({
  listColaboradores: (...args: unknown[]) => mockListColaboradores(...args),
  createColaborador: (...args: unknown[]) => mockCreateColaborador(...args),
  updateColaborador: (...args: unknown[]) => mockUpdateColaborador(...args),
}));
vi.mock('@/features/pericias/actions', () => ({
  listPericias: (...args: unknown[]) => mockListPericias(...args),
  createPericiaComPendencias: (...args: unknown[]) => mockCreatePericiaComPendencias(...args),
}));
vi.mock('@/lib/ibge/client', () => ({
  findMunicipiosPorNomeExato: (...args: unknown[]) => mockFindMunicipiosPorNomeExato(...args),
}));
vi.mock('@/features/municipios/actions', () => ({
  upsertMunicipio: (...args: unknown[]) => mockUpsertMunicipio(...args),
}));

async function criarBuffer(linhas: (string | number)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Perícias');
  linhas.forEach((linha) => worksheet.addRow(linha));
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

const HEADER = ['PERÍCIA', 'DATA', 'HORA', 'LOCAL', 'PERITO', 'CAMPO', 'SITUAÇÃO', 'OBS', 'ESCRITÓRIOS'];

beforeEach(() => {
  vi.clearAllMocks();
  mockListPeritos.mockResolvedValue([{ id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', documento: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' }]);
  mockListColaboradores.mockResolvedValue([{ id: 2, nome: 'João', contato: '', formacao: '' }]);
  mockListProcessos.mockResolvedValue([]);
  mockListPericias.mockResolvedValue([]);
  mockFindMunicipiosPorNomeExato.mockResolvedValue([{ id: 3106200, nome: 'Belo Horizonte', uf: 'MG' }]);
});

describe('previewImportacaoPericias', () => {
  it('parses a well-formed row into an "ok" preview row with all references resolved', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', 'levar EPI', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.naoProcessadas).toEqual([]);
    expect(result.linhas).toHaveLength(1);
    expect(result.linhas[0]).toMatchObject({
      status: 'ok',
      processoNumero: '0001234-56.2026',
      processoAutor: 'Maria',
      processoReu: 'João',
      processoEscritorio: 'PMRA',
      processoIdExistente: null,
      dataAgendada: '2026-09-20',
      horaAgendada: '10:00',
      municipioId: 3106200,
      municipioNome: 'Belo Horizonte',
      municipioUf: 'MG',
      peritoNome: 'Cleber',
      peritoIdExistente: 1,
      colaboradorNome: 'João',
      colaboradorIdsExistentes: [2],
      situacao: 'marcada',
      observacoes: 'levar EPI',
    });
  });

  it('keeps an unparseable PERÍCIA cell as an editable row instead of dropping it into naoProcessadas', async () => {
    const buffer = await criarBuffer([HEADER, ['texto sem separador', '', '', '', '', '', '', '', '']]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.naoProcessadas).toEqual([]);
    expect(result.linhas).toHaveLength(1);
    expect(result.linhas[0]).toMatchObject({
      status: 'atencao',
      // The raw cell text becomes the row's provisional número instead of
      // staying blank — a blank número is never deduped against anything, so
      // re-importing the same sheet would otherwise recreate this row every
      // time (confirmed in production: 147+ extra duplicates from exactly this).
      processoNumero: marcarNumeroProvisorio('texto sem separador'),
      processoAutor: '',
      processoReu: '',
    });
    expect(result.linhas[0].motivos).toContain(
      'processo não identificado no texto "texto sem separador" — usando o texto da célula como identificador provisório; edite o campo Processo manualmente'
    );
  });

  it('flags a bare processo número with no name prefix as atencao instead of dropping the row', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['5003036-80.2022.8.13.0090', '', '', 'Belo Horizonte', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.naoProcessadas).toEqual([]);
    expect(result.linhas).toHaveLength(1);
    expect(result.linhas[0]).toMatchObject({
      status: 'atencao', motivos: ['autor não identificado', 'réu não identificado'],
      processoNumero: '5003036-80.2022.8.13.0090', processoAutor: '', processoReu: '',
    });
  });

  it('flags a row as atencao with a município combobox target when the city has no match', async () => {
    mockFindMunicipiosPorNomeExato.mockResolvedValue([]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Cidade Inexistente', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('atencao');
    expect(result.linhas[0].motivos).toEqual(['município não encontrado']);
    expect(result.linhas[0].municipioId).toBeNull();
  });

  it('prefers the MG match when a city name is ambiguous across states', async () => {
    mockFindMunicipiosPorNomeExato.mockResolvedValue([
      { id: 1, nome: 'Bom Jesus', uf: 'RS' },
      { id: 2, nome: 'Bom Jesus', uf: 'MG' },
      { id: 3, nome: 'Bom Jesus', uf: 'PI' },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Bom Jesus', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].municipioId).toBe(2);
    expect(result.linhas[0].municipioUf).toBe('MG');
  });

  it('resolves a "CIDADE-UF" LOCAL value by stripping the UF suffix and matching its uf exactly', async () => {
    // The sheet's LOCAL column sometimes glues the state onto the city name
    // (e.g. "ARAQUARI-SC") — an exact-name lookup never matches that as typed.
    mockFindMunicipiosPorNomeExato.mockImplementation(async (nome: string) => {
      if (nome === 'ARAQUARI') return [{ id: 4201208, nome: 'Araquari', uf: 'SC' }];
      return [];
    });
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'ARAQUARI-SC', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].municipioId).toBe(4201208);
    expect(result.linhas[0].municipioUf).toBe('SC');
    expect(result.linhas[0].motivos).not.toContain('município não encontrado');
  });

  it('does not use a "CIDADE-UF" match whose uf disagrees with the suffix', async () => {
    mockFindMunicipiosPorNomeExato.mockImplementation(async (nome: string) => {
      if (nome === 'ARAQUARI') return [{ id: 4201208, nome: 'Araquari', uf: 'MG' }];
      return [];
    });
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'ARAQUARI-SC', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].municipioId).toBeNull();
    expect(result.linhas[0].motivos).toContain('município não encontrado');
  });

  it('flags a row atencao and requires manual perito selection when PERITO is blank', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', '', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('atencao');
    expect(result.linhas[0].motivos).toEqual(['perito não informado']);
    expect(result.linhas[0].peritoIdExistente).toBeNull();
  });

  it('marks a perito/colaborador name not found in the cadastro as null id (will be auto-created)', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', 'Perito Novo', 'Colaborador Novo', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].peritoNome).toBe('Perito Novo');
    expect(result.linhas[0].peritoIdExistente).toBeNull();
    expect(result.linhas[0].colaboradorNome).toBe('Colaborador Novo');
    expect(result.linhas[0].colaboradorIdsExistentes).toEqual([]);
    expect(result.linhas[0].status).toBe('ok');
  });

  it('flags a brand-new single-character colaborador name as suspeito, not atencao', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'I', 'CAMPO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('suspeito');
    expect(result.linhas[0].motivos).toEqual([
      'nome de colaborador "I" muito curto — será cadastrado assim mesmo, confirme se está correto',
    ]);
  });

  it('does not flag a single-character colaborador name that already exists in the cadastro', async () => {
    mockListColaboradores.mockResolvedValue([{ id: 5, nome: 'I', contato: '', formacao: '' }]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'I', 'CAMPO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('ok');
    expect(result.linhas[0].colaboradorIdsExistentes).toEqual([5]);
  });

  it('does not flag a short but plausible real colaborador name (2+ characters)', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'Jó', 'CAMPO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('ok');
  });

  it('reuses an existing processo by número and overwrites autor/reu/escritorio from the sheet', async () => {
    mockListProcessos.mockResolvedValue([{ id: 9, numero: '0001234-56.2026', autor: 'Antigo', reu: 'Antigo', escritorio: 'ANTIGO' }]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].processoIdExistente).toBe(9);
    expect(result.linhas[0].processoAutor).toBe('Maria');
  });

  it('flags SITUAÇÃO values other than CAMPO/OK/blank/canonical words as atencao, defaulting to pendente', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', 'Cleber', '', 'EM ANDAMENTO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].situacao).toBe('pendente');
    expect(result.linhas[0].status).toBe('atencao');
    expect(result.linhas[0].motivos).toEqual(['situação não reconhecida']);
  });

  it('maps "OK" to realizada and a canonical SITUAÇÃO word (e.g. CANCELADA) directly, without flagging the row', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', 'Cleber', '', 'OK', '', 'PMRA'],
      ['Ana x José - 0007654-56.2026', '', '', 'Belo Horizonte', 'Cleber', '', 'CANCELADA', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].situacao).toBe('realizada');
    expect(result.linhas[0].status).toBe('ok');
    expect(result.linhas[1].situacao).toBe('cancelada');
    expect(result.linhas[1].status).toBe('ok');
  });

  it('marks a row as duplicada when an existing pericia matches on the full composite key', async () => {
    mockListProcessos.mockResolvedValue([{ id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' }]);
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: 'levar EPI',
        processo: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaboradores: [{ id: 2, nome: 'João', contato: '', formacao: '' }],
      },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', 'levar EPI', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('duplicada');
  });

  it('marks a row as duplicada even when the DB\'s hora_agendada comes back with seconds ("10:00:00")', async () => {
    // Same root cause as the confirm-side regression test above, but on the
    // preview path — without normalizing, a re-uploaded sheet would show
    // every already-imported row as "ok" (new) instead of "duplicada".
    mockListProcessos.mockResolvedValue([{ id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' }]);
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00:00', situacao: 'marcada', observacoes: 'levar EPI',
        processo: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaboradores: [{ id: 2, nome: 'João', contato: '', formacao: '' }],
      },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', 'levar EPI', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('duplicada');
  });

  it('marks a row with no CNJ/dash processo número as duplicada on re-import, via the raw-text fallback número', async () => {
    // Before the fallback, this row's processoNumero stayed '' — which is
    // never deduped against anything — so re-importing the same sheet always
    // created a second copy. Confirmed in production: 147+ extra duplicates.
    // "PERICIA PREVIA" (no digit) stays a fully opaque fallback — see the
    // separate test below for a bare *coded* cell like "FC.02.01.055", which
    // is now recognized as a real número instead (it has a digit).
    mockListProcessos.mockResolvedValue([
      { id: 9, numero: marcarNumeroProvisorio('PERICIA PREVIA'), autor: '', reu: '', escritorio: '' },
    ]);
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2020-11-11', horaAgendada: '08:00', situacao: 'realizada', observacoes: null,
        processo: { id: 9, numero: marcarNumeroProvisorio('PERICIA PREVIA'), autor: '', reu: '', escritorio: '' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaboradores: [{ id: 2, nome: 'Lelis', contato: '', formacao: '' }],
      },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['PERICIA PREVIA', '11/11/20', '08:00', 'Belo Horizonte', 'Cleber', 'Lelis', 'OK', '', ''],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].processoNumero).toBe(marcarNumeroProvisorio('PERICIA PREVIA'));
    expect(result.linhas[0].status).toBe('duplicada');
  });

  it('treats a bare coded cell like "FC.02.01.055" as a real número (not provisório) and dedupes on it directly', async () => {
    mockListProcessos.mockResolvedValue([
      { id: 9, numero: 'FC.02.01.055', autor: '', reu: '', escritorio: '' },
    ]);
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2020-11-11', horaAgendada: '08:00', situacao: 'realizada', observacoes: null,
        processo: { id: 9, numero: 'FC.02.01.055', autor: '', reu: '', escritorio: '' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaboradores: [{ id: 2, nome: 'Lelis', contato: '', formacao: '' }],
      },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['FC.02.01.055', '11/11/20', '08:00', 'Belo Horizonte', 'Cleber', 'Lelis', 'OK', '', ''],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].processoNumero).toBe('FC.02.01.055');
    expect(result.linhas[0].status).toBe('duplicada');
  });

  it('does NOT mark as duplicada when only the observação differs (the multi-especialista case)', async () => {
    mockListProcessos.mockResolvedValue([{ id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' }]);
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: 'civil',
        processo: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaboradores: [{ id: 2, nome: 'João', contato: '', formacao: '' }],
      },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', 'agronômica', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('ok');
  });

  it('flags both sides of a same-colaborador schedule conflict between two sheet rows', async () => {
    // Different peritos (and thus not exempt by the same-perito+local carve-out
    // below) so this stays a genuine, unresolved conflict.
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
      ['Ana x José - 0007654-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Outro Perito', 'João', 'CAMPO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('ok');
    expect(result.linhas[0].motivos).toEqual([
      'João já está escalado no mesmo horário para o processo 0007654-56.2026 — esta linha será importada, a outra não',
    ]);
    expect(result.linhas[1].status).toBe('atencao');
    expect(result.linhas[1].motivos).toEqual([
      'conflito de horário: João já está escalado no mesmo horário para outra linha do processo 0001234-56.2026 — esta linha não será importada',
    ]);
  });

  it('flags a sheet row that conflicts with an existing pericia already saved in the system', async () => {
    // Different perito than the sheet row below (so this stays a genuine
    // conflict, not exempted by the same-perito+local carve-out).
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00:00', situacao: 'marcada', observacoes: null,
        processo: { id: 9, numero: '0009999-99.2019', autor: 'Outra', reu: 'Parte', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Outro Perito', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaboradores: [{ id: 2, nome: 'João', contato: '', formacao: '' }],
      },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('atencao');
    expect(result.linhas[0].motivos).toEqual([
      'conflito de horário: João já está escalado no mesmo horário para a perícia existente do processo 0009999-99.2019 — esta linha não será importada',
    ]);
  });

  it('does not flag a schedule conflict for two rows of the same processo', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', 'obs2', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].motivos).toEqual([]);
    expect(result.linhas[1].motivos).toEqual([]);
  });

  it('does not flag a schedule conflict for two rows sharing colaborador/data/hora/perito/local, even across different processos', async () => {
    // Confirmed with the user: same perito, data, hora, local AND colaborador
    // is understood as the colaborador finishing one pericia and moving
    // straight into the next — not a double-booking.
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
      ['Ana x José - 0007654-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].motivos).toEqual([]);
    expect(result.linhas[1].motivos).toEqual([]);
  });

  it('finds the header row even when a title row sits above it', async () => {
    const buffer = await criarBuffer([
      ['RELATÓRIO DE PERÍCIAS 2026'],
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.naoProcessadas).toEqual([]);
    expect(result.linhas).toHaveLength(1);
    expect(result.linhas[0].processoNumero).toBe('0001234-56.2026');
  });

  it('tags rows with the contrato read from a banner row above the header', async () => {
    const buffer = await criarBuffer([
      Array(9).fill('VALE BRUMADINHO'),
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas).toHaveLength(1);
    expect(result.linhas[0].contrato).toBe('VALE BRUMADINHO');
  });

  it('leaves contrato null for an older, single-block sheet with no banner row', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].contrato).toBeNull();
  });

  it('parses several contrato blocks in the same sheet, tagging each row with its own block\'s contrato', async () => {
    const buffer = await criarBuffer([
      Array(9).fill('VALE AT'),
      HEADER,
      ['Maria x João - 0001111-11.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
      ['Ana x José - 0002222-22.2026', '21/09/2026', '11:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
      Array(9).fill('VALE BRUMADINHO'),
      HEADER,
      ['Carlos x Davi - 0003333-33.2026', '22/09/2026', '12:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas).toHaveLength(3);
    const porContrato = Object.fromEntries(result.linhas.map((l) => [l.processoNumero, l.contrato]));
    expect(porContrato).toEqual({
      '0001111-11.2026': 'VALE AT',
      '0002222-22.2026': 'VALE AT',
      '0003333-33.2026': 'VALE BRUMADINHO',
    });
  });

  it('carries the row\'s contrato through to the pericia create payload on confirm, not the processo', async () => {
    // A processo can legitimately be worked under more than one contrato over
    // time (confirmed in a real import), so contrato describes the specific
    // pericia, not the lawsuit — it must NOT be written onto the processo.
    mockListProcessos.mockResolvedValue([]);
    mockCreateProcesso.mockResolvedValue({ success: true, data: { id: 50, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' } });
    mockCreatePericiaComPendencias.mockResolvedValue({ success: true, data: { id: 100 } });

    await confirmarImportacaoPericias([
      linhaBase({ contrato: 'VALE BRUMADINHO' }),
    ]);

    expect(mockCreateProcesso).not.toHaveBeenCalledWith(expect.objectContaining({ contrato: expect.anything() }));
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ contrato: 'VALE BRUMADINHO' }));
  });

  it('explains itself via naoProcessadas when the PERÍCIA header column is missing entirely', async () => {
    const buffer = await criarBuffer([
      ['RELATÓRIO DE PERÍCIAS 2026'],
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas).toEqual([]);
    expect(result.naoProcessadas).toEqual([
      {
        linhaOriginal: 1,
        texto: '',
        motivo: 'não foi possível encontrar a coluna "PERÍCIA" na planilha',
      },
    ]);
  });

  it('reads a richText PERITO cell as plain text instead of "[object Object]"', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Perícias');
    worksheet.addRow(HEADER);
    worksheet.addRow(['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', '', '', '', '', 'PMRA']);
    worksheet.getRow(2).getCell(5).value = { richText: [{ text: 'Cleber' }, { text: ' Silva' }] };
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].peritoNome).toBe('Cleber Silva');
  });

  it('reads a formula PERÍCIA cell via its computed result', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Perícias');
    worksheet.addRow(HEADER);
    worksheet.addRow(['', '', '', 'Belo Horizonte', 'Cleber', '', '', '', 'PMRA']);
    worksheet.getRow(2).getCell(1).value = { formula: 'Z1', result: 'Maria x João - 0001234-56.2026', date1904: false };
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const result = await previewImportacaoPericias(buffer);

    expect(result.naoProcessadas).toEqual([]);
    expect(result.linhas[0].processoNumero).toBe('0001234-56.2026');
  });
});

function linhaBase(overrides: Partial<PericiaPreviewRow> = {}): PericiaPreviewRow {
  return {
    linhaOriginal: 2,
    status: 'ok',
    motivos: [],
    processoNumero: '0001234-56.2026',
    processoAutor: 'Maria',
    processoReu: 'João',
    processoEscritorio: 'PMRA',
    processoIdExistente: null,
    dataAgendada: '2026-09-20',
    horaAgendada: '10:00',
    municipioId: 3106200,
    municipioNome: 'Belo Horizonte',
    municipioUf: 'MG',
    peritoNome: 'Cleber',
    peritoIdExistente: 1,
    colaboradorNome: 'João',
    colaboradorIdsExistentes: [2],
    situacao: 'marcada',
    observacoes: null,
    contrato: null,
    ...overrides,
  };
}

describe('confirmarImportacaoPericias', () => {
  beforeEach(() => {
    mockCreateProcesso.mockResolvedValue({ success: true, data: { id: 50, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' } });
    mockUpdateProcesso.mockResolvedValue({ success: true, data: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' } });
    mockCreatePerito.mockResolvedValue({ success: true, data: { id: 60, nome: 'Novo Perito' } });
    mockCreateColaborador.mockResolvedValue({ success: true, data: { id: 70, nome: 'Novo Colaborador' } });
    mockCreatePericiaComPendencias.mockResolvedValue({ success: true, data: { id: 100 } });
    mockListPericias.mockResolvedValue([]);
    mockUpsertMunicipio.mockResolvedValue({ id: 3106200, nome: 'Belo Horizonte', uf: 'MG' });
  });

  const PROCESSO_EXISTENTE = { id: 9, numero: '0001234-56.2026', autor: 'Antigo', reu: 'Antigo', escritorio: 'ANTIGO' };

  it('creates a new processo when processoIdExistente is null, then creates the pericia', async () => {
    const relatorio = await confirmarImportacaoPericias([linhaBase()]);

    expect(mockCreateProcesso).toHaveBeenCalledWith({
      numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA',
    });
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith({
      processoId: 50, municipioId: 3106200, peritoId: 1, colaboradorIds: [2],
      dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: null,
      contrato: null, local: 'Belo Horizonte',
    });
    expect(relatorio.processosCriados).toBe(1);
    expect(relatorio.processosAtualizados).toBe(0);
    expect(relatorio.periciasCriadas).toBe(1);
  });

  it('creates the processo and perícia even when the sheet has no ESCRITÓRIOS value (optional field)', async () => {
    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoEscritorio: '' })]);

    expect(mockCreateProcesso).toHaveBeenCalledWith(expect.objectContaining({ escritorio: '' }));
    expect(relatorio.linhasComErro).toEqual([]);
    expect(relatorio.periciasCriadas).toBe(1);
  });

  it('updates the existing processo (overwriting autor/reu/escritorio) when the fresh list has that número', async () => {
    mockListProcessos.mockResolvedValue([PROCESSO_EXISTENTE]);

    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9 })]);

    expect(mockUpdateProcesso).toHaveBeenCalledWith(9, {
      numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA',
    });
    expect(mockCreateProcesso).not.toHaveBeenCalled();
    expect(relatorio.processosAtualizados).toBe(1);
  });

  it('auto-creates a perito with just the name when peritoIdExistente is null', async () => {
    await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9, peritoNome: 'Novo Perito', peritoIdExistente: null })]);

    expect(mockCreatePerito).toHaveBeenCalledWith({
      nome: 'Novo Perito', contato: '', formacao: '', crea: '', documento: '',
      jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial',
    });
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ peritoId: 60 }));
  });

  it('creates the same new perito only once across two rows referencing it, reusing the id on the second row', async () => {
    const linhas = [
      linhaBase({ linhaOriginal: 2, processoIdExistente: 9, peritoNome: 'Novo Perito', peritoIdExistente: null }),
      linhaBase({ linhaOriginal: 3, processoIdExistente: 9, peritoNome: 'Novo Perito', peritoIdExistente: null, horaAgendada: '11:00' }),
    ];

    await confirmarImportacaoPericias(linhas);

    expect(mockCreatePerito).toHaveBeenCalledTimes(1);
    expect(mockCreatePericiaComPendencias).toHaveBeenNthCalledWith(1, expect.objectContaining({ peritoId: 60 }));
    expect(mockCreatePericiaComPendencias).toHaveBeenNthCalledWith(2, expect.objectContaining({ peritoId: 60 }));
  });

  it('leaves colaboradorIds empty when colaboradorNome is blank, without creating a colaborador', async () => {
    await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9, colaboradorNome: '', colaboradorIdsExistentes: [] })]);

    expect(mockCreateColaborador).not.toHaveBeenCalled();
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ colaboradorIds: [] }));
  });

  it('re-checks duplicidade against a fresh DB read and skips a row that now matches an existing pericia', async () => {
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: null,
        processo: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaboradores: [{ id: 2, nome: 'João', contato: '', formacao: '' }],
      },
    ]);

    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9 })]);

    expect(mockCreatePericiaComPendencias).not.toHaveBeenCalled();
    expect(relatorio.periciasCriadas).toBe(0);
    expect(relatorio.puladasPorDuplicidade).toBe(1);
    expect(relatorio.linhasPuladasPorDuplicidade).toEqual([
      { linhaOriginal: 2, erro: expect.stringContaining('banco de dados') },
    ]);
  });

  it('recognizes a duplicate even though the DB returns hora_agendada with seconds ("10:00:00") while the sheet parses to "10:00"', async () => {
    // Postgres's `time` column round-trips through Supabase as "HH:MM:SS";
    // parseHoraCelula produces "HH:MM". A naive string-equality duplicate
    // check would never match these and would re-import the whole sheet
    // every time (confirmed against production: 3062+ duplicate perícias).
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00:00', situacao: 'marcada', observacoes: null,
        processo: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaboradores: [{ id: 2, nome: 'João', contato: '', formacao: '' }],
      },
    ]);

    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9, horaAgendada: '10:00' })]);

    expect(mockCreatePericiaComPendencias).not.toHaveBeenCalled();
    expect(relatorio.periciasCriadas).toBe(0);
    expect(relatorio.puladasPorDuplicidade).toBe(1);
  });

  it('skips a row whose own status is duplicada without a fresh-DB check', async () => {
    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9, status: 'duplicada' })]);

    expect(mockCreatePericiaComPendencias).not.toHaveBeenCalled();
    expect(relatorio.puladasPorDuplicidade).toBe(1);
    expect(relatorio.linhasPuladasPorDuplicidade).toEqual([
      { linhaOriginal: 2, erro: expect.stringContaining('banco de dados') },
    ]);
  });

  it('creates the same new processo only once across two rows referencing it, reusing the id on the second row', async () => {
    const linhas = [
      linhaBase({ linhaOriginal: 2, processoIdExistente: null, horaAgendada: '10:00' }),
      linhaBase({ linhaOriginal: 3, processoIdExistente: null, horaAgendada: '11:00' }),
    ];

    const relatorio = await confirmarImportacaoPericias(linhas);

    expect(mockCreateProcesso).toHaveBeenCalledTimes(1);
    expect(mockCreatePericiaComPendencias).toHaveBeenNthCalledWith(1, expect.objectContaining({ processoId: 50 }));
    expect(mockCreatePericiaComPendencias).toHaveBeenNthCalledWith(2, expect.objectContaining({ processoId: 50 }));
    // The second row reuses the batch-created processo without rewriting it.
    expect(mockUpdateProcesso).not.toHaveBeenCalled();
    expect(relatorio.processosCriados).toBe(1);
    expect(relatorio.processosAtualizados).toBe(0);
  });

  it('updates an existing processo only once across many rows referencing it, reusing the id on the rest', async () => {
    mockListProcessos.mockResolvedValue([PROCESSO_EXISTENTE]);
    const linhas = [
      linhaBase({ linhaOriginal: 2, processoIdExistente: 9, horaAgendada: '10:00' }),
      linhaBase({ linhaOriginal: 3, processoIdExistente: 9, horaAgendada: '11:00' }),
      linhaBase({ linhaOriginal: 4, processoIdExistente: 9, horaAgendada: '12:00' }),
    ];

    const relatorio = await confirmarImportacaoPericias(linhas);

    expect(mockUpdateProcesso).toHaveBeenCalledTimes(1);
    expect(mockCreateProcesso).not.toHaveBeenCalled();
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledTimes(3);
    expect(relatorio.processosAtualizados).toBe(1);
  });

  it('skips the second of two rows in the same batch that are identical on the full duplicate-detection key', async () => {
    const linhas = [
      linhaBase({ linhaOriginal: 2, processoIdExistente: 9 }),
      linhaBase({ linhaOriginal: 3, processoIdExistente: 9 }),
    ];

    const relatorio = await confirmarImportacaoPericias(linhas);

    expect(mockCreatePericiaComPendencias).toHaveBeenCalledTimes(1);
    expect(relatorio.periciasCriadas).toBe(1);
    expect(relatorio.puladasPorDuplicidade).toBe(1);
    expect(relatorio.linhasPuladasPorDuplicidade).toEqual([
      { linhaOriginal: 3, erro: expect.stringContaining('linha 2') },
    ]);
  });

  // --- C1: municípios resolved from the IBGE API must land in the local table
  // that pericias.municipio_id has its FK to, or every insert fails.

  it('upserts the row município into the local table before creating the perícia', async () => {
    const ordem: string[] = [];
    mockUpsertMunicipio.mockImplementation(async () => { ordem.push('upsertMunicipio'); });
    mockCreatePericiaComPendencias.mockImplementation(async () => { ordem.push('createPericia'); return { success: true, data: { id: 100 } }; });

    await confirmarImportacaoPericias([linhaBase()]);

    expect(mockUpsertMunicipio).toHaveBeenCalledWith({ id: 3106200, nome: 'Belo Horizonte', uf: 'MG' });
    expect(ordem).toEqual(['upsertMunicipio', 'createPericia']);
  });

  it('upserts each distinct município once per batch, not once per row', async () => {
    const linhas = [
      linhaBase({ linhaOriginal: 2, horaAgendada: '10:00' }),
      linhaBase({ linhaOriginal: 3, horaAgendada: '11:00' }),
      linhaBase({ linhaOriginal: 4, horaAgendada: '12:00', municipioId: 3131307, municipioNome: 'Ipatinga', municipioUf: 'MG' }),
    ];

    await confirmarImportacaoPericias(linhas);

    expect(mockUpsertMunicipio).toHaveBeenCalledTimes(2);
    expect(mockUpsertMunicipio).toHaveBeenCalledWith({ id: 3106200, nome: 'Belo Horizonte', uf: 'MG' });
    expect(mockUpsertMunicipio).toHaveBeenCalledWith({ id: 3131307, nome: 'Ipatinga', uf: 'MG' });
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledTimes(3);
  });

  it('records the row as an error and skips it when the município upsert throws', async () => {
    mockUpsertMunicipio.mockRejectedValue(new Error('permission denied for table municipios'));

    const relatorio = await confirmarImportacaoPericias([linhaBase({ linhaOriginal: 4 })]);

    expect(mockCreatePericiaComPendencias).not.toHaveBeenCalled();
    expect(relatorio.periciasCriadas).toBe(0);
    expect(relatorio.linhasComErro).toEqual([
      { linhaOriginal: 4, erro: 'falha ao salvar município: permission denied for table municipios' },
    ]);
  });

  // --- C2: ids are always re-resolved against a fresh DB read.

  it('ignores a stale processoIdExistente and creates a new processo when the fresh list has no such número', async () => {
    mockListProcessos.mockResolvedValue([]);

    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9 })]);

    expect(mockUpdateProcesso).not.toHaveBeenCalled();
    expect(mockCreateProcesso).toHaveBeenCalledWith({
      numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA',
    });
    expect(relatorio.processosCriados).toBe(1);
    expect(relatorio.processosAtualizados).toBe(0);
  });

  it('does not rewrite an unrelated processo when the user corrected a typo in the número (stale id + edited número)', async () => {
    // The preview table lets the user edit processoNumero without clearing
    // processoIdExistente, so a stale id must never drive the update target.
    mockListProcessos.mockResolvedValue([PROCESSO_EXISTENTE]);

    await confirmarImportacaoPericias([
      linhaBase({ processoIdExistente: 9, processoNumero: '0009999-99.2026' }),
    ]);

    expect(mockUpdateProcesso).not.toHaveBeenCalled();
    expect(mockCreateProcesso).toHaveBeenCalledWith(expect.objectContaining({ numero: '0009999-99.2026' }));
  });

  it('resolves the processo from the fresh list even when processoIdExistente is null', async () => {
    mockListProcessos.mockResolvedValue([PROCESSO_EXISTENTE]);

    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: null })]);

    expect(mockCreateProcesso).not.toHaveBeenCalled();
    expect(mockUpdateProcesso).toHaveBeenCalledWith(9, expect.objectContaining({ numero: '0001234-56.2026' }));
    expect(relatorio.processosAtualizados).toBe(1);
  });

  it('re-resolves a corrected perito name against the fresh list instead of creating a duplicate', async () => {
    // The preview table clears peritoIdExistente whenever the name is edited,
    // so fixing "Cleberr" -> "Cleber" arrives with a null id but an existing name.
    mockListProcessos.mockResolvedValue([PROCESSO_EXISTENTE]);

    await confirmarImportacaoPericias([linhaBase({ peritoNome: 'Cleber', peritoIdExistente: null })]);

    expect(mockCreatePerito).not.toHaveBeenCalled();
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ peritoId: 1 }));
  });

  it('re-resolves a corrected colaborador name against the fresh list instead of creating a duplicate', async () => {
    mockListProcessos.mockResolvedValue([PROCESSO_EXISTENTE]);

    await confirmarImportacaoPericias([linhaBase({ colaboradorNome: 'João', colaboradorIdsExistentes: [] })]);

    expect(mockCreateColaborador).not.toHaveBeenCalled();
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ colaboradorIds: [2] }));
  });

  it('ignores a stale peritoIdExistente and creates when the fresh list no longer has that name', async () => {
    mockListPeritos.mockResolvedValue([]);
    mockListProcessos.mockResolvedValue([PROCESSO_EXISTENTE]);

    await confirmarImportacaoPericias([linhaBase({ peritoNome: 'Cleber', peritoIdExistente: 1 })]);

    expect(mockCreatePerito).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Cleber' }));
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ peritoId: 60 }));
  });

  // --- C3 / I1: failures are reported instead of silently dropping the row.

  it('records a linhaComErro with the DB message when createPericia fails', async () => {
    mockListProcessos.mockResolvedValue([PROCESSO_EXISTENTE]);
    mockCreatePericiaComPendencias.mockResolvedValue({ success: false, error: 'violates foreign key constraint "pericias_municipio_id_fkey"' });

    const relatorio = await confirmarImportacaoPericias([linhaBase({ linhaOriginal: 7 })]);

    expect(relatorio.periciasCriadas).toBe(0);
    expect(relatorio.linhasComErro).toEqual([
      { linhaOriginal: 7, erro: 'falha ao criar perícia: violates foreign key constraint "pericias_municipio_id_fkey"' },
    ]);
  });

  it('records a linhaComErro and skips the row when the processo cannot be created', async () => {
    mockCreateProcesso.mockResolvedValue({ success: false, error: 'Já existe um processo com esse número' });

    const relatorio = await confirmarImportacaoPericias([linhaBase({ linhaOriginal: 3 })]);

    expect(mockCreatePericiaComPendencias).not.toHaveBeenCalled();
    expect(relatorio.processosCriados).toBe(0);
    expect(relatorio.linhasComErro).toEqual([
      { linhaOriginal: 3, erro: 'falha ao criar processo: Já existe um processo com esse número' },
    ]);
  });

  it('records a linhaComErro and skips the row when the perito cannot be created', async () => {
    mockListProcessos.mockResolvedValue([PROCESSO_EXISTENTE]);
    mockCreatePerito.mockResolvedValue({ success: false, error: 'nome é obrigatório' });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ linhaOriginal: 5, peritoNome: 'Perito Novo', peritoIdExistente: null }),
    ]);

    expect(mockCreatePericiaComPendencias).not.toHaveBeenCalled();
    expect(relatorio.linhasComErro).toEqual([{ linhaOriginal: 5, erro: 'falha ao criar perito: nome é obrigatório' }]);
  });

  it('saves the pericia with peritoId null instead of rejecting the row when there is no perito at all', async () => {
    mockListProcessos.mockResolvedValue([PROCESSO_EXISTENTE]);
    mockCreatePericiaComPendencias.mockResolvedValue({ success: true, data: { id: 100 } });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ linhaOriginal: 6, peritoNome: '', peritoIdExistente: null }),
    ]);

    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ peritoId: null }));
    expect(relatorio.linhasComErro).toEqual([]);
    expect(relatorio.periciasCriadas).toBe(1);
  });

  it('saves the pericia with municipioId null instead of rejecting an atencao row whose município was never resolved', async () => {
    mockCreatePericiaComPendencias.mockResolvedValue({ success: true, data: { id: 100 } });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ linhaOriginal: 8, status: 'atencao', motivos: ['município não encontrado'], municipioId: null }),
    ]);

    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ municipioId: null }));
    expect(mockUpsertMunicipio).not.toHaveBeenCalled();
    expect(relatorio.periciasCriadas).toBe(1);
    expect(relatorio.linhasComErro).toEqual([]);
  });

  it('saves the pericia without a processo instead of rejecting a row whose número was never identified', async () => {
    mockCreatePericiaComPendencias.mockResolvedValue({ success: true, data: { id: 100 } });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ linhaOriginal: 11, processoNumero: '' }),
    ]);

    expect(mockCreateProcesso).not.toHaveBeenCalled();
    expect(mockUpdateProcesso).not.toHaveBeenCalled();
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ processoId: null }));
    expect(relatorio.periciasCriadas).toBe(1);
    expect(relatorio.linhasComErro).toEqual([]);
  });

  it('creates the processo even with a blank autor/réu instead of rejecting the row', async () => {
    mockCreateProcesso.mockResolvedValue({
      success: true, data: { id: 50, numero: '0001234-56.2026', autor: '', reu: 'Vale', escritorio: 'PMRA' },
    });
    mockCreatePericiaComPendencias.mockResolvedValue({ success: true, data: { id: 100 } });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ linhaOriginal: 12, processoAutor: '' }),
    ]);

    expect(mockCreateProcesso).toHaveBeenCalledWith(expect.objectContaining({ autor: '' }));
    expect(relatorio.periciasCriadas).toBe(1);
    expect(relatorio.linhasComErro).toEqual([]);
  });

  it('retries without colaboradores and reports an aviso (not an erro) when the DB rejects a genuine double-booking', async () => {
    mockCreatePericiaComPendencias
      .mockResolvedValueOnce({
        success: false, error: 'Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.',
      })
      .mockResolvedValueOnce({ success: true, data: { id: 100 } });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ linhaOriginal: 13, colaboradorNome: 'João', colaboradorIdsExistentes: [2] }),
    ]);

    expect(mockCreatePericiaComPendencias).toHaveBeenNthCalledWith(1, expect.objectContaining({ colaboradorIds: [2] }));
    expect(mockCreatePericiaComPendencias).toHaveBeenNthCalledWith(2, expect.objectContaining({ colaboradorIds: [] }));
    expect(relatorio.periciasCriadas).toBe(1);
    expect(relatorio.linhasComErro).toEqual([]);
    expect(relatorio.linhasComAviso).toHaveLength(1);
    expect(relatorio.linhasComAviso[0].linhaOriginal).toBe(13);
    expect(relatorio.linhasComAviso[0].erro).toContain('já está atribuído a outra perícia');
  });

  it('reports a genuine erro (not just a dropped colaborador) when the retry without colaboradores also fails', async () => {
    mockCreatePericiaComPendencias
      .mockResolvedValueOnce({
        success: false, error: 'Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.',
      })
      .mockResolvedValueOnce({ success: false, error: 'erro inesperado' });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ linhaOriginal: 14, colaboradorNome: 'João', colaboradorIdsExistentes: [2] }),
    ]);

    expect(relatorio.periciasCriadas).toBe(0);
    expect(relatorio.linhasComAviso).toEqual([]);
    expect(relatorio.linhasComErro).toEqual([{ linhaOriginal: 14, erro: 'falha ao criar perícia: erro inesperado' }]);
  });

  it('creates a single-character colaborador name anyway, links it, and flags it as an aviso', async () => {
    mockCreateColaborador.mockResolvedValue({ success: true, data: { id: 71, nome: 'I' } });
    mockCreatePericiaComPendencias.mockResolvedValue({ success: true, data: { id: 100 } });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ linhaOriginal: 9, colaboradorNome: 'I', colaboradorIdsExistentes: [] }),
    ]);

    expect(mockCreateColaborador).toHaveBeenCalledWith(expect.objectContaining({ nome: 'I' }));
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ colaboradorIds: [71] }));
    expect(relatorio.linhasComErro).toEqual([]);
    expect(relatorio.periciasCriadas).toBe(1);
    expect(relatorio.linhasComAviso).toEqual([
      {
        linhaOriginal: 9,
        erro: 'colaborador(es) com nome muito curto vinculado(s): "I". Confirme se está correto e corrija/mescle o cadastro se necessário.',
      },
    ]);
  });

  it('still allows reusing an existing colaborador whose cadastro name happens to be a single character', async () => {
    mockListColaboradores.mockResolvedValue([{ id: 5, nome: 'I', contato: '', formacao: '' }]);
    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ linhaOriginal: 10, colaboradorNome: 'I', colaboradorIdsExistentes: [] }),
    ]);

    expect(mockCreateColaborador).not.toHaveBeenCalled();
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ colaboradorIds: [5] }));
    expect(relatorio.linhasComErro).toEqual([]);
  });

  it('reports no errors and an empty linhasComErro on a fully successful batch', async () => {
    const relatorio = await confirmarImportacaoPericias([linhaBase()]);
    expect(relatorio.linhasComErro).toEqual([]);
    expect(relatorio.periciasCriadas).toBe(1);
  });

  it('resolves "Nome1/Nome2" in CAMPO into multiple colaboradorIds, reusing existing ones and creating new ones', async () => {
    mockListColaboradores.mockResolvedValue([{ id: 2, nome: 'João', contato: '', formacao: '' }]);
    mockCreateColaborador.mockResolvedValue({ success: true, data: { id: 71, nome: 'Julio Cesar Mulatti' } });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ colaboradorNome: 'João/Julio Cesar Mulatti', colaboradorIdsExistentes: [2] }),
    ]);

    expect(mockCreateColaborador).toHaveBeenCalledTimes(1);
    expect(mockCreateColaborador).toHaveBeenCalledWith({ nome: 'Julio Cesar Mulatti', contato: '', formacao: '', email: '' });
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ colaboradorIds: [2, 71] }));
    expect(relatorio.colaboradoresCriados).toBe(1);
    expect(relatorio.linhasComErro).toEqual([]);
  });

  it('still fails the whole row when a (non-suspicious) named colaborador genuinely fails to be created', async () => {
    mockListColaboradores.mockResolvedValue([]);
    mockCreateColaborador.mockResolvedValue({ success: false, error: 'nome é obrigatório' });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ colaboradorNome: 'Novo Colaborador', colaboradorIdsExistentes: [] }),
    ]);

    expect(mockCreatePericiaComPendencias).not.toHaveBeenCalled();
    expect(relatorio.linhasComErro).toEqual([
      { linhaOriginal: 2, erro: 'falha ao criar colaborador: nome é obrigatório' },
    ]);
  });

  it('creates both a genuinely new colaborador and a suspicious single-character one from a mixed CAMPO, flagging only the latter', async () => {
    mockListColaboradores.mockResolvedValue([]);
    mockCreateColaborador.mockImplementation(async ({ nome }: { nome: string }) => ({
      success: true, data: { id: nome === 'I' ? 72 : 71, nome },
    }));
    mockCreatePericiaComPendencias.mockResolvedValue({ success: true, data: { id: 100 } });

    const relatorio = await confirmarImportacaoPericias([
      linhaBase({ colaboradorNome: 'Novo Colaborador/I', colaboradorIdsExistentes: [] }),
    ]);

    expect(mockCreateColaborador).toHaveBeenCalledTimes(2);
    expect(mockCreateColaborador).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Novo Colaborador' }));
    expect(mockCreateColaborador).toHaveBeenCalledWith(expect.objectContaining({ nome: 'I' }));
    expect(mockCreatePericiaComPendencias).toHaveBeenCalledWith(expect.objectContaining({ colaboradorIds: [71, 72] }));
    expect(relatorio.linhasComErro).toEqual([]);
    expect(relatorio.periciasCriadas).toBe(1);
    expect(relatorio.linhasComAviso).toEqual([
      { linhaOriginal: 2, erro: 'colaborador(es) com nome muito curto vinculado(s): "I". Confirme se está correto e corrija/mescle o cadastro se necessário.' },
    ]);
  });
});

async function criarPlanilhaPeritosColaboradores(linhas: (string | number)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Peritos e Colaboradores');
  linhas.forEach((linha) => worksheet.addRow(linha));
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe('previewImportacaoPeritosColaboradores', () => {
  beforeEach(() => {
    mockListPeritos.mockResolvedValue([]);
    mockListColaboradores.mockResolvedValue([]);
  });

  it('splits the sheet into Colaborador rows (before "PERITO") and Perito rows (from "PERITO" onward)', async () => {
    const buffer = await criarPlanilhaPeritosColaboradores([
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['Ana', '31999990000'],
      [],
      ['PERITO', 'CONTATO', 'FORMAÇÃO', 'CREA', 'CPF', 'JÁ TRABALHAMOS?', 'RELAÇÃO', 'RESULTADOS'],
      ['Carlos', '31988880000', 'Eng. Civil', 'CREA-123', '111.222.333-44', 'SIM', 'boa', 'positivo'],
    ]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.colaboradores).toEqual([
      expect.objectContaining({ nome: 'Ana', contato: '31999990000', status: 'ok', idExistente: null }),
    ]);
    expect(result.peritos).toEqual([
      expect.objectContaining({
        nome: 'Carlos', contato: '31988880000', formacao: 'Eng. Civil', crea: 'CREA-123',
        documento: '111.222.333-44', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
        status: 'ok', idExistente: null,
      }),
    ]);
  });

  it('marks a colaborador/perito name that already exists with its existing id', async () => {
    mockListColaboradores.mockResolvedValue([{ id: 5, nome: 'Ana', contato: '', formacao: '' }]);
    const buffer = await criarPlanilhaPeritosColaboradores([
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['Ana', '31999990000'],
      ['PERITO', 'CONTATO', 'FORMAÇÃO', 'CREA', 'CPF', 'JÁ TRABALHAMOS?', 'RELAÇÃO', 'RESULTADOS'],
    ]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.colaboradores[0].idExistente).toBe(5);
  });

  it('flags an unrecognized relação/resultados as atencao', async () => {
    const buffer = await criarPlanilhaPeritosColaboradores([
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['PERITO', 'CONTATO', 'FORMAÇÃO', 'CREA', 'CPF', 'JÁ TRABALHAMOS?', 'RELAÇÃO', 'RESULTADOS'],
      ['Carlos', '', '', '', '', '', 'excelente', 'positivo'],
    ]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.peritos[0].status).toBe('atencao');
    expect(result.peritos[0].motivo).toBe('relação não reconhecida');
  });

  it('finds columns identified by header text even when reordered', async () => {
    const buffer = await criarPlanilhaPeritosColaboradores([
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['PERITO', 'FORMAÇÃO', 'CONTATO', 'RESULTADOS', 'RELAÇÃO', 'JÁ TRABALHAMOS?', 'CREA', 'CPF'],
      ['Carlos', 'Eng. Civil', '31988880000', 'positivo', 'boa', 'SIM', 'CREA-123', '111.222.333-44'],
    ]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.peritos[0]).toMatchObject({
      nome: 'Carlos', formacao: 'Eng. Civil', contato: '31988880000',
      resultados: 'positivo', relacao: 'boa', jaTrabalhamos: true, crea: 'CREA-123', documento: '111.222.333-44',
    });
  });

  it('finds the colaborador header even when title/blank rows sit above it', async () => {
    const buffer = await criarPlanilhaPeritosColaboradores([
      [],
      [],
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['Ana', '31999990000'],
      [],
      [],
      ['PERITO', 'CONTATO', 'FORMAÇÃO', 'CREA', 'CPF', 'JÁ TRABALHAMOS?', 'RELAÇÃO', 'RESULTADOS'],
      ['Carlos', '31988880000', 'Eng. Civil', 'CREA-123', '111.222.333-44', 'SIM', 'ÓTIMA', 'POSITIVO'],
    ]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.colaboradores).toEqual([
      expect.objectContaining({ nome: 'Ana', contato: '31999990000', status: 'ok', idExistente: null }),
    ]);
    expect(result.peritos[0]).toMatchObject({ nome: 'Carlos', relacao: 'otima', resultados: 'positivo', status: 'ok' });
  });

  it('returns an empty result when the "PERITO" header row is never found', async () => {
    const buffer = await criarPlanilhaPeritosColaboradores([['COLABORADORES ÉTICA', 'CONTATO'], ['Ana', '31999990000']]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.colaboradores).toEqual([]);
    expect(result.peritos).toEqual([]);
    expect(result.naoProcessadas).toEqual([
      { linhaOriginal: 0, texto: '', motivo: 'não foi possível encontrar o cabeçalho "PERITO" na planilha' },
    ]);
  });
});

describe('confirmarImportacaoPeritosColaboradores', () => {
  beforeEach(() => {
    mockCreateColaborador.mockResolvedValue({ success: true, data: { id: 5, nome: 'Ana' } });
    mockUpdateColaborador.mockResolvedValue({ success: true, data: { id: 5, nome: 'Ana' } });
    mockCreatePerito.mockResolvedValue({ success: true, data: { id: 6, nome: 'Carlos' } });
    mockUpdatePerito.mockResolvedValue({ success: true, data: { id: 6, nome: 'Carlos' } });
  });

  it('creates a new colaborador when idExistente is null', async () => {
    const colaborador: ColaboradorPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '31999990000', idExistente: null,
    };
    const relatorio = await confirmarImportacaoPeritosColaboradores([colaborador], []);

    expect(mockCreateColaborador).toHaveBeenCalledWith({ nome: 'Ana', contato: '31999990000', formacao: '', email: '' });
    expect(relatorio.colaboradoresCriados).toBe(1);
  });

  it('overwrites an existing colaborador when idExistente is set', async () => {
    mockListColaboradores.mockResolvedValue([{ id: 5, nome: 'Ana', contato: '31999990000', formacao: '', email: null }]);
    const colaborador: ColaboradorPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '31999990000', idExistente: 5,
    };
    const relatorio = await confirmarImportacaoPeritosColaboradores([colaborador], []);

    expect(mockUpdateColaborador).toHaveBeenCalledWith(5, { nome: 'Ana', contato: '31999990000', formacao: '', email: '' });
    expect(relatorio.colaboradoresAtualizados).toBe(1);
  });

  it('creates a new perito with all fields when idExistente is null', async () => {
    const perito: PeritoPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Carlos', contato: '31988880000',
      formacao: 'Eng. Civil', crea: 'CREA-123', documento: '111.222.333-44',
      jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo', idExistente: null,
    };
    const relatorio = await confirmarImportacaoPeritosColaboradores([], [perito]);

    expect(mockCreatePerito).toHaveBeenCalledWith({
      nome: 'Carlos', contato: '31988880000', formacao: 'Eng. Civil', crea: 'CREA-123',
      documento: '111.222.333-44', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    });
    expect(relatorio.peritosCriados).toBe(1);
  });

  it('overwrites an existing perito with all fields when idExistente is set', async () => {
    mockListPeritos.mockResolvedValue([
      { id: 6, nome: 'Carlos', contato: '31988880000', formacao: 'Eng. Civil', crea: 'CREA-123', documento: '111.222.333-44', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
    ]);
    const perito: PeritoPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Carlos', contato: '31988880000',
      formacao: 'Eng. Civil', crea: 'CREA-123', documento: '111.222.333-44',
      jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo', idExistente: 6,
    };
    const relatorio = await confirmarImportacaoPeritosColaboradores([], [perito]);

    expect(mockUpdatePerito).toHaveBeenCalledWith(6, {
      nome: 'Carlos', contato: '31988880000', formacao: 'Eng. Civil', crea: 'CREA-123',
      documento: '111.222.333-44', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    });
    expect(relatorio.peritosAtualizados).toBe(1);
  });

  it('creates the same new colaborador only once across two rows referencing it, updating it on the second row', async () => {
    mockCreateColaborador.mockResolvedValue({ success: true, data: { id: 8, nome: 'Zeca' } });
    const colaboradores: ColaboradorPreviewRow[] = [
      { linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Zeca', contato: '31900001111', idExistente: null },
      { linhaOriginal: 3, status: 'ok', motivo: null, nome: 'Zeca', contato: '31900002222', idExistente: null },
    ];

    const relatorio = await confirmarImportacaoPeritosColaboradores(colaboradores, []);

    expect(mockCreateColaborador).toHaveBeenCalledTimes(1);
    expect(mockCreateColaborador).toHaveBeenCalledWith({ nome: 'Zeca', contato: '31900001111', formacao: '', email: '' });
    expect(mockUpdateColaborador).toHaveBeenCalledWith(8, { nome: 'Zeca', contato: '31900002222', formacao: '', email: '' });
    expect(relatorio.colaboradoresCriados).toBe(1);
    expect(relatorio.colaboradoresAtualizados).toBe(1);
  });

  it('resolves to an update via a fresh DB match even when idExistente was null in the stale preview snapshot', async () => {
    mockListPeritos.mockResolvedValue([
      { id: 9, nome: 'Carlos', contato: '', formacao: '', crea: '', documento: '', jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial' },
    ]);
    const perito: PeritoPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Carlos', contato: '31988880000',
      formacao: 'Eng. Civil', crea: 'CREA-123', documento: '111.222.333-44',
      jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo', idExistente: null,
    };

    const relatorio = await confirmarImportacaoPeritosColaboradores([], [perito]);

    expect(mockCreatePerito).not.toHaveBeenCalled();
    expect(mockUpdatePerito).toHaveBeenCalledWith(9, {
      nome: 'Carlos', contato: '31988880000', formacao: 'Eng. Civil', crea: 'CREA-123',
      documento: '111.222.333-44', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    });
    expect(relatorio.peritosAtualizados).toBe(1);
  });

  it('ignores a stale idExistente and creates instead when the fresh colaborador list has no matching name (renamed/deleted since preview)', async () => {
    mockListColaboradores.mockResolvedValue([{ id: 2, nome: 'João', contato: '', formacao: '', email: null }]);
    mockCreateColaborador.mockResolvedValue({ success: true, data: { id: 9, nome: 'Ana' } });
    const colaborador: ColaboradorPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '31999990000', idExistente: 5,
    };

    const relatorio = await confirmarImportacaoPeritosColaboradores([colaborador], []);

    expect(mockUpdateColaborador).not.toHaveBeenCalled();
    expect(mockCreateColaborador).toHaveBeenCalledWith({ nome: 'Ana', contato: '31999990000', formacao: '', email: '' });
    expect(relatorio.colaboradoresCriados).toBe(1);
    expect(relatorio.colaboradoresAtualizados).toBe(0);
  });

  it('ignores a stale idExistente and creates instead when the fresh perito list has no matching name (renamed/deleted since preview)', async () => {
    mockListPeritos.mockResolvedValue([{ id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', documento: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' }]);
    mockCreatePerito.mockResolvedValue({ success: true, data: { id: 10, nome: 'Carlos' } });
    const perito: PeritoPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Carlos', contato: '31988880000',
      formacao: 'Eng. Civil', crea: 'CREA-123', documento: '111.222.333-44',
      jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo', idExistente: 6,
    };

    const relatorio = await confirmarImportacaoPeritosColaboradores([], [perito]);

    expect(mockUpdatePerito).not.toHaveBeenCalled();
    expect(mockCreatePerito).toHaveBeenCalledWith({
      nome: 'Carlos', contato: '31988880000', formacao: 'Eng. Civil', crea: 'CREA-123',
      documento: '111.222.333-44', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    });
    expect(relatorio.peritosCriados).toBe(1);
    expect(relatorio.peritosAtualizados).toBe(0);
  });

  // --- I3: the Tab 2 sheet has no formação column for colaboradores.

  it('preserves the stored formação and email of an existing colaborador instead of blanking them', async () => {
    mockListColaboradores.mockResolvedValue([
      { id: 5, nome: 'Ana', contato: '31900000000', formacao: 'Engenheira Agrônoma', email: 'ana@exemplo.com' },
    ]);
    const colaborador: ColaboradorPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '31999990000', idExistente: 5,
    };

    await confirmarImportacaoPeritosColaboradores([colaborador], []);

    expect(mockUpdateColaborador).toHaveBeenCalledWith(5, {
      nome: 'Ana', contato: '31999990000', formacao: 'Engenheira Agrônoma', email: 'ana@exemplo.com',
    });
  });

  it('still creates a colaborador with a blank formação and email when there is nothing to carry through', async () => {
    const colaborador: ColaboradorPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '31999990000', idExistente: null,
    };

    await confirmarImportacaoPeritosColaboradores([colaborador], []);

    expect(mockCreateColaborador).toHaveBeenCalledWith({ nome: 'Ana', contato: '31999990000', formacao: '', email: '' });
  });

  // --- C3: write failures surface in the report.

  it('records a linhaComErro when a colaborador write fails', async () => {
    mockCreateColaborador.mockResolvedValue({ success: false, error: 'nome é obrigatório' });
    const colaborador: ColaboradorPreviewRow = {
      linhaOriginal: 4, status: 'ok', motivo: null, nome: 'Ana', contato: '', idExistente: null,
    };

    const relatorio = await confirmarImportacaoPeritosColaboradores([colaborador], []);

    expect(relatorio.colaboradoresCriados).toBe(0);
    expect(relatorio.linhasComErro).toEqual([{ linhaOriginal: 4, erro: 'falha ao criar colaborador: nome é obrigatório' }]);
  });

  it('records a linhaComErro when a perito update fails', async () => {
    mockListPeritos.mockResolvedValue([
      { id: 6, nome: 'Carlos', contato: '', formacao: '', crea: '', documento: '', jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial' },
    ]);
    mockUpdatePerito.mockResolvedValue({ success: false, error: 'CPF inválido' });
    const perito: PeritoPreviewRow = {
      linhaOriginal: 9, status: 'ok', motivo: null, nome: 'Carlos', contato: '', formacao: '', crea: '',
      documento: 'xxx', jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial', idExistente: 6,
    };

    const relatorio = await confirmarImportacaoPeritosColaboradores([], [perito]);

    expect(relatorio.peritosAtualizados).toBe(0);
    expect(relatorio.linhasComErro).toEqual([{ linhaOriginal: 9, erro: 'falha ao atualizar perito: CPF inválido' }]);
  });

  it('reports an empty linhasComErro on a fully successful batch', async () => {
    const colaborador: ColaboradorPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '', idExistente: null,
    };
    const relatorio = await confirmarImportacaoPeritosColaboradores([colaborador], []);
    expect(relatorio.linhasComErro).toEqual([]);
  });
});
