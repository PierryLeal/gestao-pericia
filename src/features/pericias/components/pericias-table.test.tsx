import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PericiasTable } from './pericias-table';
import type { PericiaListItem } from '../actions';

const items: PericiaListItem[] = [
  {
    id: 1,
    dataAgendada: '2026-08-01',
    horaAgendada: '14:30',
    situacao: 'marcada',
    observacoes: 'Levar equipamento de medição extra para esta perícia específica',
    processo: {
      id: 1, numero: '0001234-56.2026.8.26.0100', autor: 'Maria Souza', reu: 'João Pereira', escritorio: 'PMRA',
    },
    municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
    perito: {
      id: 1, nome: 'Carlos Lima', contato: '(11) 90000-0000', formacao: 'Eng. Civil', crea: '123456',
      jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    },
    colaborador: null,
  },
];

const itemSemData: PericiaListItem = {
  ...items[0],
  id: 2,
  dataAgendada: null,
  horaAgendada: null,
};

const itemSemObservacoes: PericiaListItem = { ...items[0], id: 3, observacoes: null };

describe('PericiasTable', () => {
  it('renders the required columns without the detail row initially', () => {
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('0001234-56.2026.8.26.0100')).toBeInTheDocument();
    expect(screen.getByText('São Paulo/SP')).toBeInTheDocument();
    expect(screen.getByText('Carlos Lima')).toBeInTheDocument();
    expect(screen.queryByText(/Autor: Maria Souza/)).not.toBeInTheDocument();
  });

  it('expands the detail row with processo/perito/colaborador blocks when the chevron is clicked', async () => {
    const user = userEvent.setup();
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /detalhes da perícia/i }));

    expect(screen.getByText(/Autor: Maria Souza/)).toBeInTheDocument();
    expect(screen.getByText(/Réu: João Pereira/)).toBeInTheDocument();
    expect(screen.getByText(/CREA: 123456/)).toBeInTheDocument();
    expect(screen.getByText('Boa')).toBeInTheDocument();
    expect(screen.getByText('Positivo')).toBeInTheDocument();
    expect(screen.getByText('Nenhum colaborador vinculado.')).toBeInTheDocument();
  });

  it('collapses the detail row when the chevron is clicked again', async () => {
    const user = userEvent.setup();
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} />);

    const toggle = screen.getByRole('button', { name: /detalhes da perícia/i });
    await user.click(toggle);
    expect(screen.getByText(/Autor: Maria Souza/)).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText(/Autor: Maria Souza/)).not.toBeInTheDocument();
  });

  it('calls onEdit when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<PericiasTable items={items} onEdit={onEdit} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /editar perícia/i }));

    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it('shows a message when there are no items', () => {
    render(<PericiasTable items={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Nenhuma perícia encontrada.')).toBeInTheDocument();
  });

  it('shows "Não agendado" when dataAgendada and horaAgendada are both null', () => {
    render(<PericiasTable items={[itemSemData]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Não agendado')).toBeInTheDocument();
  });

  it('opens a confirmation dialog and calls onDelete when confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir perícia/i }));
    expect(screen.getByText(/excluir a perícia do processo "0001234-56\.2026\.8\.26\.0100"/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });

  it('does not call onDelete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir perícia/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows the full Observações text (visually truncated by CSS, not shortened in the DOM)', () => {
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(
      screen.getByText('Levar equipamento de medição extra para esta perícia específica')
    ).toBeInTheDocument();
  });

  it('shows a dash in the Obs. column when observacoes is null', () => {
    render(<PericiasTable items={[itemSemObservacoes]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const row = screen.getByText('0001234-56.2026.8.26.0100').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows the processo escritorio', () => {
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('PMRA')).toBeInTheDocument();
  });

  it('shows the total count and paginates at 30 per page', async () => {
    const muitos: PericiaListItem[] = Array.from({ length: 35 }, (_, i) => ({
      ...items[0],
      id: i + 1,
      processo: { ...items[0].processo, numero: `PROCESSO-${i + 1}` },
    }));
    const user = userEvent.setup();
    render(<PericiasTable items={muitos} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('35 perícias')).toBeInTheDocument();
    expect(screen.getByText('PROCESSO-1')).toBeInTheDocument();
    expect(screen.queryByText('PROCESSO-31')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    expect(screen.getByText('PROCESSO-31')).toBeInTheDocument();
    expect(screen.queryByText('PROCESSO-1')).not.toBeInTheDocument();
  });
});
