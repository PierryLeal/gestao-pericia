import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { previewImportacaoPericias } from './actions';

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

const mockListPeritos = vi.fn();
const mockListColaboradores = vi.fn();
const mockListProcessos = vi.fn();
const mockListPericias = vi.fn();
const mockSearchMunicipios = vi.fn();

vi.mock('@/features/peritos/actions', () => ({ listPeritos: (...args: unknown[]) => mockListPeritos(...args) }));
vi.mock('@/features/colaboradores/actions', () => ({
  listColaboradores: (...args: unknown[]) => mockListColaboradores(...args),
}));
vi.mock('@/features/processos/actions', () => ({ listProcessos: (...args: unknown[]) => mockListProcessos(...args) }));
vi.mock('@/features/pericias/actions', () => ({ listPericias: (...args: unknown[]) => mockListPericias(...args) }));
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
