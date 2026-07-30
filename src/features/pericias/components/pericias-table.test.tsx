import { render, screen } from '@testing-library/react';
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
    processo: { id: 1, numero: '0001234-56.2026.8.26.0100', autor: 'Maria Souza', reu: 'João Pereira' },
    municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
    perito: {
      id: 1, nome: 'Carlos Lima', contato: '(11) 90000-0000', formacao: 'Eng. Civil', crea: '123456',
      jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    },
    colaborador: null,
  },
];

describe('PericiasTable', () => {
  it('renders the required columns without the detail row initially', () => {
    render(<PericiasTable items={items} onEdit={vi.fn()} />);
    expect(screen.getByText('0001234-56.2026.8.26.0100')).toBeInTheDocument();
    expect(screen.getByText('São Paulo/SP')).toBeInTheDocument();
    expect(screen.getByText('Carlos Lima')).toBeInTheDocument();
    expect(screen.queryByText(/Autor: Maria Souza/)).not.toBeInTheDocument();
  });

  it('expands the detail row with processo/perito/colaborador blocks when the chevron is clicked', async () => {
    const user = userEvent.setup();
    render(<PericiasTable items={items} onEdit={vi.fn()} />);

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
    render(<PericiasTable items={items} onEdit={vi.fn()} />);

    const toggle = screen.getByRole('button', { name: /detalhes da perícia/i });
    await user.click(toggle);
    expect(screen.getByText(/Autor: Maria Souza/)).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText(/Autor: Maria Souza/)).not.toBeInTheDocument();
  });

  it('calls onEdit when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<PericiasTable items={items} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /editar perícia/i }));

    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it('shows a message when there are no items', () => {
    render(<PericiasTable items={[]} onEdit={vi.fn()} />);
    expect(screen.getByText('Nenhuma perícia encontrada.')).toBeInTheDocument();
  });
});
