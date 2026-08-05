import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { previewImportacaoPericias, confirmarImportacaoPericias } from './actions';
import type { PericiaPreviewRow } from './types';

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

const mockListPeritos = vi.fn();
const mockListColaboradores = vi.fn();
const mockListProcessos = vi.fn();
const mockListPericias = vi.fn();
const mockSearchMunicipios = vi.fn();
const mockCreateProcesso = vi.fn();
const mockUpdateProcesso = vi.fn();
const mockCreatePerito = vi.fn();
const mockCreateColaborador = vi.fn();
const mockCreatePericia = vi.fn();

vi.mock('@/features/processos/actions', () => ({
  listProcessos: (...args: unknown[]) => mockListProcessos(...args),
  createProcesso: (...args: unknown[]) => mockCreateProcesso(...args),
  updateProcesso: (...args: unknown[]) => mockUpdateProcesso(...args),
}));
vi.mock('@/features/peritos/actions', () => ({
  listPeritos: (...args: unknown[]) => mockListPeritos(...args),
  createPerito: (...args: unknown[]) => mockCreatePerito(...args),
}));
vi.mock('@/features/colaboradores/actions', () => ({
  listColaboradores: (...args: unknown[]) => mockListColaboradores(...args),
  createColaborador: (...args: unknown[]) => mockCreateColaborador(...args),
}));
vi.mock('@/features/pericias/actions', () => ({
  listPericias: (...args: unknown[]) => mockListPericias(...args),
  createPericia: (...args: unknown[]) => mockCreatePericia(...args),
}));
vi.mock('@/lib/ibge/client', () => ({ searchMunicipios: (...args: unknown[]) => mockSearchMunicipios(...args) }));

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
  mockSearchMunicipios.mockResolvedValue([{ id: 3106200, nome: 'Belo Horizonte', uf: 'MG' }]);
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
      colaboradorIdExistente: 2,
      situacao: 'marcada',
      observacoes: 'levar EPI',
    });
  });

  it('sends an unparseable PERÍCIA cell to naoProcessadas instead of linhas', async () => {
    const buffer = await criarBuffer([HEADER, ['texto sem separador', '', '', '', '', '', '', '', '']]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas).toEqual([]);
    expect(result.naoProcessadas).toEqual([
      { linhaOriginal: 2, texto: 'texto sem separador', motivo: 'não foi possível identificar o número do processo' },
    ]);
  });

  it('flags a row as atencao with a município combobox target when the city has no match', async () => {
    mockSearchMunicipios.mockResolvedValue([]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Cidade Inexistente', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('atencao');
    expect(result.linhas[0].motivo).toBe('município não encontrado');
    expect(result.linhas[0].municipioId).toBeNull();
  });

  it('prefers the MG match when a city name is ambiguous across states', async () => {
    mockSearchMunicipios.mockResolvedValue([
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

  it('flags a row atencao and requires manual perito selection when PERITO is blank', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', '', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('atencao');
    expect(result.linhas[0].motivo).toBe('perito não informado');
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
    expect(result.linhas[0].colaboradorIdExistente).toBeNull();
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

  it('flags SITUAÇÃO values other than CAMPO/blank as atencao, defaulting to pendente', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', 'Cleber', '', 'REALIZADA', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].situacao).toBe('pendente');
    expect(result.linhas[0].status).toBe('atencao');
    expect(result.linhas[0].motivo).toBe('situação não reconhecida');
  });

  it('marks a row as duplicada when an existing pericia matches on the full composite key', async () => {
    mockListProcessos.mockResolvedValue([{ id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' }]);
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: 'levar EPI',
        processo: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaborador: { id: 2, nome: 'João', contato: '', formacao: '' },
      },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', 'levar EPI', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

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
        colaborador: { id: 2, nome: 'João', contato: '', formacao: '' },
      },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', 'agronômica', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('ok');
  });
});

function linhaBase(overrides: Partial<PericiaPreviewRow> = {}): PericiaPreviewRow {
  return {
    linhaOriginal: 2,
    status: 'ok',
    motivo: null,
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
    colaboradorIdExistente: 2,
    situacao: 'marcada',
    observacoes: null,
    ...overrides,
  };
}

describe('confirmarImportacaoPericias', () => {
  beforeEach(() => {
    mockCreateProcesso.mockResolvedValue({ success: true, data: { id: 50, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' } });
    mockUpdateProcesso.mockResolvedValue({ success: true, data: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' } });
    mockCreatePerito.mockResolvedValue({ success: true, data: { id: 60, nome: 'Novo Perito' } });
    mockCreateColaborador.mockResolvedValue({ success: true, data: { id: 70, nome: 'Novo Colaborador' } });
    mockCreatePericia.mockResolvedValue({ success: true, data: { id: 100 } });
    mockListPericias.mockResolvedValue([]);
  });

  it('creates a new processo when processoIdExistente is null, then creates the pericia', async () => {
    const relatorio = await confirmarImportacaoPericias([linhaBase()]);

    expect(mockCreateProcesso).toHaveBeenCalledWith({
      numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA',
    });
    expect(mockCreatePericia).toHaveBeenCalledWith({
      processoId: 50, municipioId: 3106200, peritoId: 1, colaboradorId: 2,
      dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: null,
    });
    expect(relatorio.processosCriados).toBe(1);
    expect(relatorio.processosAtualizados).toBe(0);
    expect(relatorio.periciasCriadas).toBe(1);
  });

  it('updates the existing processo (overwriting autor/reu/escritorio) when processoIdExistente is set', async () => {
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
    expect(mockCreatePericia).toHaveBeenCalledWith(expect.objectContaining({ peritoId: 60 }));
  });

  it('creates the same new perito only once across two rows referencing it, reusing the id on the second row', async () => {
    const linhas = [
      linhaBase({ linhaOriginal: 2, processoIdExistente: 9, peritoNome: 'Novo Perito', peritoIdExistente: null }),
      linhaBase({ linhaOriginal: 3, processoIdExistente: 9, peritoNome: 'Novo Perito', peritoIdExistente: null, horaAgendada: '11:00' }),
    ];

    await confirmarImportacaoPericias(linhas);

    expect(mockCreatePerito).toHaveBeenCalledTimes(1);
    expect(mockCreatePericia).toHaveBeenNthCalledWith(1, expect.objectContaining({ peritoId: 60 }));
    expect(mockCreatePericia).toHaveBeenNthCalledWith(2, expect.objectContaining({ peritoId: 60 }));
  });

  it('leaves colaboradorId null when colaboradorNome is blank, without creating a colaborador', async () => {
    await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9, colaboradorNome: '', colaboradorIdExistente: null })]);

    expect(mockCreateColaborador).not.toHaveBeenCalled();
    expect(mockCreatePericia).toHaveBeenCalledWith(expect.objectContaining({ colaboradorId: null }));
  });

  it('re-checks duplicidade against a fresh DB read and skips a row that now matches an existing pericia', async () => {
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: null,
        processo: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaborador: { id: 2, nome: 'João', contato: '', formacao: '' },
      },
    ]);

    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9 })]);

    expect(mockCreatePericia).not.toHaveBeenCalled();
    expect(relatorio.periciasCriadas).toBe(0);
    expect(relatorio.puladasPorDuplicidade).toBe(1);
  });

  it('skips a row whose own status is duplicada without a fresh-DB check', async () => {
    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9, status: 'duplicada' })]);

    expect(mockCreatePericia).not.toHaveBeenCalled();
    expect(relatorio.puladasPorDuplicidade).toBe(1);
  });
});
