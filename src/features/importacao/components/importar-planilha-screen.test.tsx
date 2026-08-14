import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { ImportarPlanilhaScreen } from './importar-planilha-screen';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockPreviewPericias = vi.fn();
const mockConfirmarPericias = vi.fn();
const mockPreviewPeritosColaboradores = vi.fn();
const mockConfirmarPeritosColaboradores = vi.fn();
vi.mock('../actions', () => ({
  previewImportacaoPericias: (...args: unknown[]) => mockPreviewPericias(...args),
  confirmarImportacaoPericias: (...args: unknown[]) => mockConfirmarPericias(...args),
  previewImportacaoPeritosColaboradores: (...args: unknown[]) => mockPreviewPeritosColaboradores(...args),
  confirmarImportacaoPeritosColaboradores: (...args: unknown[]) => mockConfirmarPeritosColaboradores(...args),
}));

function arquivoFake(nome = 'planilha.xlsx') {
  return new File(['conteudo'], nome, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Stat tiles render the count and its label in separate elements (for distinct
// typography), so the pair is found by locating the label and reading its sibling.
function valorDoStatTile(rotulo: string) {
  const label = screen.getByText(rotulo);
  return within(label.parentElement as HTMLElement);
}

const LINHA_PREVIEW = {
  linhaOriginal: 2, status: 'ok', motivos: [],
  processoNumero: '0001234-56.2026', processoAutor: 'Maria', processoReu: 'João', processoEscritorio: 'PMRA',
  processoIdExistente: null, dataAgendada: '2026-09-20', horaAgendada: '10:00',
  municipioId: 3106200, municipioNome: 'Belo Horizonte', municipioUf: 'MG',
  peritoNome: 'Cleber', peritoIdExistente: 1, colaboradorNome: 'João', colaboradorIdsExistentes: [2],
  situacao: 'marcada', observacoes: null,
};

const RELATORIO_PERICIAS_VAZIO = {
  processosCriados: 0, processosAtualizados: 0, periciasCriadas: 0,
  peritosCriados: 0, colaboradoresCriados: 0, puladasPorDuplicidade: 0,
  linhasComErro: [], linhasComAviso: [], linhasPuladasPorDuplicidade: [],
};

const RELATORIO_PERITOS_VAZIO = {
  peritosCriados: 0, peritosAtualizados: 0, colaboradoresCriados: 0, colaboradoresAtualizados: 0, linhasComErro: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImportarPlanilhaScreen — aba Perícias e Processos', () => {
  it('processes an uploaded file and shows the preview table', async () => {
    mockPreviewPericias.mockResolvedValue({
      linhas: [{
        linhaOriginal: 2, status: 'ok', motivos: [],
        processoNumero: '0001234-56.2026', processoAutor: 'Maria', processoReu: 'João', processoEscritorio: 'PMRA',
        processoIdExistente: null, dataAgendada: '2026-09-20', horaAgendada: '10:00',
        municipioId: 3106200, municipioNome: 'Belo Horizonte', municipioUf: 'MG',
        peritoNome: 'Cleber', peritoIdExistente: 1, colaboradorNome: 'João', colaboradorIdsExistentes: [2],
        situacao: 'marcada', observacoes: null,
      }],
      naoProcessadas: [],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    const input = screen.getByLabelText(/planilha de perícias/i);
    await user.upload(input, arquivoFake());

    await waitFor(() => expect(screen.getByDisplayValue('0001234-56.2026')).toBeInTheDocument());
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
        linhaOriginal: 2, status: 'ok', motivos: [],
        processoNumero: '0001234-56.2026', processoAutor: 'Maria', processoReu: 'João', processoEscritorio: 'PMRA',
        processoIdExistente: null, dataAgendada: '2026-09-20', horaAgendada: '10:00',
        municipioId: 3106200, municipioNome: 'Belo Horizonte', municipioUf: 'MG',
        peritoNome: 'Cleber', peritoIdExistente: 1, colaboradorNome: 'João', colaboradorIdsExistentes: [2],
        situacao: 'marcada', observacoes: null,
      }],
      naoProcessadas: [],
    });
    mockConfirmarPericias.mockResolvedValue({ ...RELATORIO_PERICIAS_VAZIO, processosCriados: 1, periciasCriadas: 1 });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByDisplayValue('0001234-56.2026')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    await waitFor(() => expect(mockConfirmarPericias).toHaveBeenCalledWith([
      expect.objectContaining({ processoNumero: '0001234-56.2026' }),
    ]));
    await waitFor(() => expect(screen.getByText('perícia criada')).toBeInTheDocument());
    expect(valorDoStatTile('perícia criada').getByText('1')).toBeInTheDocument();
  });

  it('confirms a large batch in chunks and sums the merged report', async () => {
    // 260 rendered table rows is genuinely slow in jsdom under full-suite load.
    const muitasLinhas = Array.from({ length: 260 }, (_, i) => ({ ...LINHA_PREVIEW, linhaOriginal: i + 2 }));
    mockPreviewPericias.mockResolvedValue({ linhas: muitasLinhas, naoProcessadas: [] });
    mockConfirmarPericias.mockImplementation(async (lote: unknown[]) => ({
      ...RELATORIO_PERICIAS_VAZIO, periciasCriadas: lote.length,
    }));
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByText(/260 linhas encontradas/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    await waitFor(() => expect(mockConfirmarPericias).toHaveBeenCalledTimes(2));
    expect(mockConfirmarPericias.mock.calls[0][0]).toHaveLength(250);
    expect(mockConfirmarPericias.mock.calls[1][0]).toHaveLength(10);

    await waitFor(() => expect(screen.getByText('perícias criadas')).toBeInTheDocument());
    expect(valorDoStatTile('perícias criadas').getByText('260')).toBeInTheDocument();
  }, 20000);

  it('shows progress between confirm batches', async () => {
    const muitasLinhas = Array.from({ length: 260 }, (_, i) => ({ ...LINHA_PREVIEW, linhaOriginal: i + 2 }));
    mockPreviewPericias.mockResolvedValue({ linhas: muitasLinhas, naoProcessadas: [] });
    function loteControlado() {
      let resolver!: (valor: typeof RELATORIO_PERICIAS_VAZIO) => void;
      const pendente = new Promise<typeof RELATORIO_PERICIAS_VAZIO>((resolve) => { resolver = resolve; });
      return { pendente, resolver: () => resolver({ ...RELATORIO_PERICIAS_VAZIO, periciasCriadas: 1 }) };
    }
    const lote1 = loteControlado();
    const lote2 = loteControlado();
    mockConfirmarPericias
      .mockImplementationOnce(() => lote1.pendente)
      .mockImplementationOnce(() => lote2.pendente);

    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);
    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByText(/260 linhas encontradas/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    expect(await screen.findByRole('button', { name: /confirmando\.\.\. 0 de 260/i })).toBeInTheDocument();

    lote1.resolver();

    expect(await screen.findByRole('button', { name: /confirmando\.\.\. 250 de 260/i })).toBeInTheDocument();

    lote2.resolver();
    // The preview (and its confirm button) is replaced by the report once every batch lands.
    await waitFor(() => expect(screen.queryByRole('button', { name: /confirmando/i })).not.toBeInTheDocument());
    expect(screen.getByText('Resultado da importação')).toBeInTheDocument();
  }, 20000);

  it('keeps only the not-yet-processed rows in the preview when a later batch fails', async () => {
    const muitasLinhas = Array.from({ length: 260 }, (_, i) => ({ ...LINHA_PREVIEW, linhaOriginal: i + 2 }));
    mockPreviewPericias.mockResolvedValue({ linhas: muitasLinhas, naoProcessadas: [] });
    mockConfirmarPericias
      .mockResolvedValueOnce({ ...RELATORIO_PERICIAS_VAZIO, periciasCriadas: 250 })
      .mockRejectedValueOnce(new Error('Unauthorized'));

    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);
    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByText(/260 linhas encontradas/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    // The batch that succeeded before the failure is still reported...
    expect(valorDoStatTile('perícias criadas').getByText('250')).toBeInTheDocument();
    // ...and the 10 rows never attempted stay in the preview for a retry.
    await waitFor(() => expect(screen.getByText(/10 linhas encontradas/i)).toBeInTheDocument());
  }, 20000);

  it('disables the confirm button when there are no ok/atencao rows', async () => {
    mockPreviewPericias.mockResolvedValue({ linhas: [], naoProcessadas: [] });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());

    await waitFor(() => expect(screen.getByRole('button', { name: /confirmar importação/i })).toBeDisabled());
  });

  it('explains that every row was already imported when re-uploading the same sheet', async () => {
    mockPreviewPericias.mockResolvedValue({
      linhas: [{ ...LINHA_PREVIEW, status: 'duplicada' }],
      naoProcessadas: [],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());

    await waitFor(() => expect(screen.getByRole('button', { name: /confirmar importação/i })).toBeDisabled());
    expect(
      screen.getByText(/essa linha já foi importada anteriormente — não há nada novo para confirmar/i)
    ).toBeInTheDocument();
  });

  it('does not show the "already imported" message when the upload itself has no rows at all', async () => {
    mockPreviewPericias.mockResolvedValue({ linhas: [], naoProcessadas: [] });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());

    await waitFor(() => expect(screen.getByRole('button', { name: /confirmar importação/i })).toBeDisabled());
    expect(screen.queryByText(/já foi importada anteriormente/i)).not.toBeInTheDocument();
  });

  it('lists the rows that failed to import, with their reasons, in the report', async () => {
    mockPreviewPericias.mockResolvedValue({ linhas: [LINHA_PREVIEW], naoProcessadas: [] });
    mockConfirmarPericias.mockResolvedValue({
      ...RELATORIO_PERICIAS_VAZIO,
      periciasCriadas: 1,
      linhasComErro: [
        { linhaOriginal: 7, erro: 'falha ao criar processo: Já existe um processo com esse número' },
        { linhaOriginal: 9, erro: 'município não resolvido' },
      ],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByDisplayValue('0001234-56.2026')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    expect(await screen.findByText(/2 linhas com erro/i)).toBeInTheDocument();
    expect(screen.getByText(/Linha 7: falha ao criar processo: Já existe um processo com esse número/)).toBeInTheDocument();
    expect(screen.getByText(/Linha 9: município não resolvido/)).toBeInTheDocument();
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('2 linhas falharam'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows an amber "linhas criadas com aviso" section, separate from erros, for rows saved with a dropped colaborador', async () => {
    mockPreviewPericias.mockResolvedValue({ linhas: [LINHA_PREVIEW], naoProcessadas: [] });
    mockConfirmarPericias.mockResolvedValue({
      ...RELATORIO_PERICIAS_VAZIO,
      periciasCriadas: 1,
      linhasComAviso: [
        { linhaOriginal: 13, erro: 'perícia criada, mas sem o(s) colaborador(es) da planilha: conflito de horário.' },
      ],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByDisplayValue('0001234-56.2026')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    expect(await screen.findByText(/linha criada com aviso/i)).toBeInTheDocument();
    expect(screen.getByText(/Linha 13: perícia criada, mas sem o\(s\) colaborador/)).toBeInTheDocument();
    expect(screen.queryByText(/linha com erro/i)).not.toBeInTheDocument();
  });

  it('shows a "linhas puladas por duplicidade" section, separate from erros/avisos, with the reason', async () => {
    mockPreviewPericias.mockResolvedValue({ linhas: [LINHA_PREVIEW], naoProcessadas: [] });
    mockConfirmarPericias.mockResolvedValue({
      ...RELATORIO_PERICIAS_VAZIO,
      periciasCriadas: 1,
      puladasPorDuplicidade: 1,
      linhasPuladasPorDuplicidade: [
        { linhaOriginal: 7, erro: 'linha idêntica à linha 2 desta mesma planilha (mesmo processo, data, hora, perito e colaborador(es)) — não foi criada de novo para não duplicar o mesmo agendamento.' },
      ],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByDisplayValue('0001234-56.2026')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    expect(await screen.findByText(/linha pulada por duplicidade/i)).toBeInTheDocument();
    expect(screen.getByText(/Linha 7: linha idêntica à linha 2/)).toBeInTheDocument();
    expect(screen.queryByText(/linha com erro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/linha criada com aviso/i)).not.toBeInTheDocument();
  });

  it('filters both the erros and avisos lists by a typed keyword', async () => {
    mockPreviewPericias.mockResolvedValue({ linhas: [LINHA_PREVIEW], naoProcessadas: [] });
    mockConfirmarPericias.mockResolvedValue({
      ...RELATORIO_PERICIAS_VAZIO,
      periciasCriadas: 1,
      linhasComErro: [
        { linhaOriginal: 7, erro: 'falha ao criar processo: Autor é obrigatório' },
        { linhaOriginal: 9, erro: 'município não resolvido' },
      ],
      linhasComAviso: [
        { linhaOriginal: 13, erro: 'perícia criada, mas sem o(s) colaborador(es): conflito de horário.' },
      ],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByDisplayValue('0001234-56.2026')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));
    await screen.findByText(/com erro/i);

    await user.type(screen.getByPlaceholderText(/filtrar por palavra/i), 'colaborador');

    expect(screen.queryByText(/Linha 7:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Linha 9:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Linha 13:/)).toBeInTheDocument();
  });

  it('does not mention errors in the report when nothing failed', async () => {
    mockPreviewPericias.mockResolvedValue({ linhas: [LINHA_PREVIEW], naoProcessadas: [] });
    mockConfirmarPericias.mockResolvedValue({ ...RELATORIO_PERICIAS_VAZIO, periciasCriadas: 1 });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByDisplayValue('0001234-56.2026')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    await waitFor(() => expect(screen.getByText('perícia criada')).toBeInTheDocument());
    expect(valorDoStatTile('perícia criada').getByText('1')).toBeInTheDocument();
    expect(screen.queryByText(/linha.* com erro/i)).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Importação concluída com sucesso.');
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('shows an error toast and clears the spinner when the preview action rejects', async () => {
    mockPreviewPericias.mockRejectedValue(new Error('Body exceeded 1 MB limit'));
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    const input = screen.getByLabelText(/planilha de perícias/i);
    await user.upload(input, arquivoFake());

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(input).not.toBeDisabled();
  });

  it('shows an error toast and re-enables the confirm button when the confirm action rejects', async () => {
    mockPreviewPericias.mockResolvedValue({ linhas: [LINHA_PREVIEW], naoProcessadas: [] });
    mockConfirmarPericias.mockRejectedValue(new Error('Unauthorized'));
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByDisplayValue('0001234-56.2026')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    // The preview survives the failure so the user can retry.
    expect(screen.getByRole('button', { name: /confirmar importação/i })).not.toBeDisabled();
  });
});

describe('ImportarPlanilhaScreen — aba Peritos e Colaboradores', () => {
  it('shows the second tab, processes its upload, and confirms it independently from Tab 1', async () => {
    mockPreviewPeritosColaboradores.mockResolvedValue({
      colaboradores: [{ linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '', idExistente: null }],
      peritos: [],
      naoProcessadas: [],
    });
    mockConfirmarPeritosColaboradores.mockResolvedValue({ ...RELATORIO_PERITOS_VAZIO, colaboradoresCriados: 1 });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.click(screen.getByRole('tab', { name: /peritos e colaboradores/i }));
    await user.upload(screen.getByLabelText(/planilha de peritos/i), arquivoFake());

    await waitFor(() => expect(screen.getByDisplayValue('Ana')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    await waitFor(() => expect(mockConfirmarPeritosColaboradores).toHaveBeenCalledWith(
      [expect.objectContaining({ nome: 'Ana' })],
      []
    ));
    await waitFor(() => expect(screen.getByText('colaborador criado')).toBeInTheDocument());
    expect(valorDoStatTile('colaborador criado').getByText('1')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Importação concluída com sucesso.');
  });

  it('lists the rows that failed to import in the Tab 2 report', async () => {
    mockPreviewPeritosColaboradores.mockResolvedValue({
      colaboradores: [{ linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '', idExistente: null }],
      peritos: [],
      naoProcessadas: [],
    });
    mockConfirmarPeritosColaboradores.mockResolvedValue({
      ...RELATORIO_PERITOS_VAZIO,
      linhasComErro: [{ linhaOriginal: 4, erro: 'falha ao criar colaborador: nome é obrigatório' }],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.click(screen.getByRole('tab', { name: /peritos e colaboradores/i }));
    await user.upload(screen.getByLabelText(/planilha de peritos/i), arquivoFake());
    await waitFor(() => expect(screen.getByDisplayValue('Ana')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    expect(await screen.findByText(/1 linha com erro/i)).toBeInTheDocument();
    expect(screen.getByText(/Linha 4: falha ao criar colaborador: nome é obrigatório/)).toBeInTheDocument();
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('1 linha falhou'));
  });

  it('shows an error toast when the Tab 2 confirm action rejects', async () => {
    mockPreviewPeritosColaboradores.mockResolvedValue({
      colaboradores: [{ linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '', idExistente: null }],
      peritos: [],
      naoProcessadas: [],
    });
    mockConfirmarPeritosColaboradores.mockRejectedValue(new Error('Unauthorized'));
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.click(screen.getByRole('tab', { name: /peritos e colaboradores/i }));
    await user.upload(screen.getByLabelText(/planilha de peritos/i), arquivoFake());
    await waitFor(() => expect(screen.getByDisplayValue('Ana')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it('shows an error toast when the Tab 2 preview action rejects', async () => {
    mockPreviewPeritosColaboradores.mockRejectedValue(new Error('corrupt file'));
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.click(screen.getByRole('tab', { name: /peritos e colaboradores/i }));
    await user.upload(screen.getByLabelText(/planilha de peritos/i), arquivoFake());

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });
});
