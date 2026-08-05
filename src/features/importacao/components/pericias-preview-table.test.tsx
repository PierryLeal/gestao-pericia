import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PericiasPreviewTable } from './pericias-preview-table';
import type { PericiaPreviewRow } from '../types';

vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({
    selected,
    onChange,
  }: {
    selected: { id: number; nome: string; uf: string } | null;
    onChange: (m: { id: number; nome: string; uf: string }) => void;
  }) => (
    <div>
      {selected && <span>{selected.nome}/{selected.uf}</span>}
      <button type="button" onClick={() => onChange({ id: 99, nome: 'Ouro Preto', uf: 'MG' })}>
        selecionar município
      </button>
    </div>
  ),
}));

function linhaBase(overrides: Partial<PericiaPreviewRow> = {}): PericiaPreviewRow {
  return {
    linhaOriginal: 2, status: 'ok', motivo: null,
    processoNumero: '0001234-56.2026', processoAutor: 'Maria', processoReu: 'João', processoEscritorio: 'PMRA',
    processoIdExistente: null, dataAgendada: '2026-09-20', horaAgendada: '10:00',
    municipioId: 3106200, municipioNome: 'Belo Horizonte', municipioUf: 'MG',
    peritoNome: 'Cleber', peritoIdExistente: 1, colaboradorNome: 'João', colaboradorIdExistente: 2,
    situacao: 'marcada', observacoes: null,
    ...overrides,
  };
}

describe('PericiasPreviewTable', () => {
  it('shows every row with its processo número and município', () => {
    render(<PericiasPreviewTable linhas={[linhaBase()]} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('0001234-56.2026')).toBeInTheDocument();
    expect(screen.getByText(/Belo Horizonte/)).toBeInTheDocument();
  });

  it('marks a new perito/colaborador name with a "(novo)" indicator', () => {
    render(
      <PericiasPreviewTable
        linhas={[linhaBase({ peritoNome: 'Perito Novo', peritoIdExistente: null })]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('Perito Novo')).toBeInTheDocument();
    expect(screen.getByText('(novo)')).toBeInTheDocument();
  });

  it('shows a município combobox and calls onChange with the picked município when status is atencao with no município', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PericiasPreviewTable
        linhas={[linhaBase({ status: 'atencao', motivo: 'município não encontrado', municipioId: null, municipioNome: 'Cidade X', municipioUf: '' })]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByText('selecionar município'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ municipioId: 99, municipioNome: 'Ouro Preto', municipioUf: 'MG' }),
    ]);
  });

  it('shows the current município in the combobox when already resolved, and still allows changing it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PericiasPreviewTable linhas={[linhaBase()]} onChange={onChange} />);

    expect(screen.getByText('Belo Horizonte/MG')).toBeInTheDocument();

    await user.click(screen.getByText('selecionar município'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ municipioId: 99, municipioNome: 'Ouro Preto', municipioUf: 'MG' }),
    ]);
  });

  it('lets the user edit the situação of a flagged row via the select', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PericiasPreviewTable
        linhas={[linhaBase({ status: 'atencao', motivo: 'situação não reconhecida' })]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /situação/i }));
    await user.click(await screen.findByRole('option', { name: 'realizada' }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ situacao: 'realizada' })]);
  });

  it('shows duplicada rows dimmed with an explanatory reason', () => {
    render(
      <PericiasPreviewTable
        linhas={[linhaBase({ status: 'duplicada', motivo: 'perícia já importada anteriormente' })]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('perícia já importada anteriormente')).toBeInTheDocument();
  });

  it('lets the user edit the processo número, calling onChange with the updated value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PericiasPreviewTable linhas={[linhaBase()]} onChange={onChange} />);

    const input = screen.getByDisplayValue('0001234-56.2026');
    await user.type(input, '9');

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ processoNumero: '0001234-56.20269' }),
    ]);
  });

  it('lets the user edit the perito nome, clearing peritoIdExistente since it may no longer match', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PericiasPreviewTable linhas={[linhaBase()]} onChange={onChange} />);

    const input = screen.getByDisplayValue('Cleber');
    await user.type(input, 'x');

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ peritoNome: 'Cleberx', peritoIdExistente: null }),
    ]);
  });

  it('lets the user edit the colaborador nome, clearing colaboradorIdExistente since it may no longer match', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PericiasPreviewTable linhas={[linhaBase()]} onChange={onChange} />);

    const input = screen.getByDisplayValue('João');
    await user.type(input, 'x');

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ colaboradorNome: 'Joãox', colaboradorIdExistente: null }),
    ]);
  });

  it('keeps fields editable (not disabled) on duplicada rows, just visually dimmed', () => {
    render(
      <PericiasPreviewTable
        linhas={[linhaBase({ status: 'duplicada', motivo: 'perícia já importada anteriormente' })]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('0001234-56.2026')).not.toBeDisabled();
    expect(screen.getByDisplayValue('Cleber')).not.toBeDisabled();
    expect(screen.getByDisplayValue('João')).not.toBeDisabled();
  });
});
