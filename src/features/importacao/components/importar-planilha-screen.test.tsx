import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ImportarPlanilhaScreen } from './importar-planilha-screen';

const mockPreviewPericias = vi.fn();
const mockConfirmarPericias = vi.fn();
vi.mock('../actions', () => ({
  previewImportacaoPericias: (...args: unknown[]) => mockPreviewPericias(...args),
  confirmarImportacaoPericias: (...args: unknown[]) => mockConfirmarPericias(...args),
  previewImportacaoPeritosColaboradores: vi.fn(async () => ({ colaboradores: [], peritos: [], naoProcessadas: [] })),
  confirmarImportacaoPeritosColaboradores: vi.fn(),
}));

function arquivoFake(nome = 'planilha.xlsx') {
  return new File(['conteudo'], nome, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

describe('ImportarPlanilhaScreen — aba Perícias e Processos', () => {
  it('processes an uploaded file and shows the preview table', async () => {
    mockPreviewPericias.mockResolvedValue({
      linhas: [{
        linhaOriginal: 2, status: 'ok', motivo: null,
        processoNumero: '0001234-56.2026', processoAutor: 'Maria', processoReu: 'João', processoEscritorio: 'PMRA',
        processoIdExistente: null, dataAgendada: '2026-09-20', horaAgendada: '10:00',
        municipioId: 3106200, municipioNome: 'Belo Horizonte', municipioUf: 'MG',
        peritoNome: 'Cleber', peritoIdExistente: 1, colaboradorNome: 'João', colaboradorIdExistente: 2,
        situacao: 'marcada', observacoes: null,
      }],
      naoProcessadas: [],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    const input = screen.getByLabelText(/planilha de perícias/i);
    await user.upload(input, arquivoFake());

    await waitFor(() => expect(screen.getByText('0001234-56.2026')).toBeInTheDocument());
  });

  it('shows naoProcessadas rows in a separate, non-editable list', async () => {
    mockPreviewPericias.mockResolvedValue({
      linhas: [],
      naoProcessadas: [{ linhaOriginal: 3, texto: 'texto ruim', motivo: 'não foi possível identificar o número do processo' }],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());

    await waitFor(() => expect(screen.getByText('texto ruim')).toBeInTheDocument());
    expect(screen.getByText('não foi possível identificar o número do processo')).toBeInTheDocument();
  });

  it('calls confirmarImportacaoPericias with the (possibly edited) preview rows and shows the report', async () => {
    mockPreviewPericias.mockResolvedValue({
      linhas: [{
        linhaOriginal: 2, status: 'ok', motivo: null,
        processoNumero: '0001234-56.2026', processoAutor: 'Maria', processoReu: 'João', processoEscritorio: 'PMRA',
        processoIdExistente: null, dataAgendada: '2026-09-20', horaAgendada: '10:00',
        municipioId: 3106200, municipioNome: 'Belo Horizonte', municipioUf: 'MG',
        peritoNome: 'Cleber', peritoIdExistente: 1, colaboradorNome: 'João', colaboradorIdExistente: 2,
        situacao: 'marcada', observacoes: null,
      }],
      naoProcessadas: [],
    });
    mockConfirmarPericias.mockResolvedValue({
      processosCriados: 1, processosAtualizados: 0, periciasCriadas: 1,
      peritosCriados: 0, colaboradoresCriados: 0, puladasPorDuplicidade: 0,
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByText('0001234-56.2026')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    await waitFor(() => expect(mockConfirmarPericias).toHaveBeenCalledWith([
      expect.objectContaining({ processoNumero: '0001234-56.2026' }),
    ]));
    expect(await screen.findByText(/1 perícia criada/i)).toBeInTheDocument();
  });

  it('disables the confirm button when there are no ok/atencao rows', async () => {
    mockPreviewPericias.mockResolvedValue({ linhas: [], naoProcessadas: [] });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());

    await waitFor(() => expect(screen.getByRole('button', { name: /confirmar importação/i })).toBeDisabled());
  });
});
