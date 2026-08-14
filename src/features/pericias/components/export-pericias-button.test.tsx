import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportPericiasButton } from './export-pericias-button';
import type { PericiaListItem } from '../actions';

const mockListPericias = vi.fn();
vi.mock('../actions', () => ({
  listPericias: (...args: unknown[]) => mockListPericias(...args),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

const mockAddRow = vi.fn();
const mockAddRows = vi.fn();
const mockWriteBuffer = vi.fn();
const mockAddWorksheet = vi.fn(() => ({
  columns: [],
  addRow: mockAddRow,
  addRows: mockAddRows,
  getRow: vi.fn(() => ({})),
}));

vi.mock('exceljs', () => ({
  default: {
    Workbook: vi.fn(function MockWorkbook(this: { addWorksheet: typeof mockAddWorksheet; xlsx: { writeBuffer: typeof mockWriteBuffer } }) {
      this.addWorksheet = mockAddWorksheet;
      this.xlsx = { writeBuffer: mockWriteBuffer };
    }),
  },
}));

const items: PericiaListItem[] = [
  {
    id: 1,
    dataAgendada: '2026-09-16',
    horaAgendada: '10:00',
    situacao: 'pendente' as const,
    observacoes: null,
    contrato: null,
    local: null,
    processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y', escritorio: 'PMRA' },
    municipio: { id: 3, nome: 'Belo Horizonte', uf: 'MG' },
    perito: {
      id: 7, nome: 'Cleber', contato: '', formacao: '', crea: '',
      jaTrabalhamos: true, relacao: 'boa' as const, resultados: 'positivo' as const,
    },
    colaboradores: [],
    problemas: [],
  },
];

describe('ExportPericiasButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
    mockWriteBuffer.mockResolvedValue(new Uint8Array([1, 2, 3]));
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  it('calls listPericias with the filters read from the current URL', async () => {
    searchParams = new URLSearchParams(
      'situacao=marcada&busca=1234&dataInicio=2026-09-01&dataFim=2026-09-30&municipioId=3&peritoId=7&colaboradorId=2'
    );
    mockListPericias.mockResolvedValue(items);
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(mockListPericias).toHaveBeenCalledWith({
      situacao: 'marcada',
      busca: '1234',
      dataInicio: '2026-09-01',
      dataFim: '2026-09-30',
      municipioId: 3,
      peritoId: 7,
      colaboradorId: 2,
    });
  });

  it('omits unset filters instead of sending empty strings', async () => {
    mockListPericias.mockResolvedValue(items);
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(mockListPericias).toHaveBeenCalledWith({});
  });

  it('shows an informational message and does not build a workbook when there is nothing to export', async () => {
    mockListPericias.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(mockToastInfo).toHaveBeenCalledWith('Nenhuma perícia para exportar com os filtros atuais.');
    expect(mockAddWorksheet).not.toHaveBeenCalled();
  });

  it('builds the workbook with the 9 columns in order and triggers a download', async () => {
    mockListPericias.mockResolvedValue(items);
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(mockAddWorksheet).toHaveBeenCalledWith('Perícias');
    const worksheet = mockAddWorksheet.mock.results[0].value;
    expect(worksheet.columns.map((c: { header: string }) => c.header)).toEqual([
      'Nº Processo', 'Autor', 'Réu', 'Data', 'Hora', 'Local', 'Perito', 'Colaborador', 'Situação',
    ]);
    expect(mockAddRows).toHaveBeenCalledWith([
      {
        numero: '0001234-56.2026',
        autor: 'Autor X',
        reu: 'Réu Y',
        data: new Date('2026-09-16'),
        hora: '10:00',
        local: 'Belo Horizonte/MG',
        perito: 'Cleber',
        colaborador: '',
        situacao: 'Pendente',
      },
    ]);
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith('Planilha exportada');
  });

  it('joins multiple colaboradores with "/", mirroring the import format', async () => {
    mockListPericias.mockResolvedValue([
      {
        ...items[0],
        colaboradores: [
          { id: 1, nome: 'Igor Navarro', contato: '', formacao: '' },
          { id: 2, nome: 'Julio Cesar Mulatti', contato: '', formacao: '' },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(mockAddRows).toHaveBeenCalledWith([
      expect.objectContaining({ colaborador: 'Igor Navarro/Julio Cesar Mulatti' }),
    ]);
  });

  it('shows an error message when listPericias fails', async () => {
    mockListPericias.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(mockToastError).toHaveBeenCalledWith('Não foi possível exportar as perícias.');
  });
});
