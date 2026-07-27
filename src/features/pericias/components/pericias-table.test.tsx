import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
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
      jaTrabalhamos: true, relacao: 8, resultados: 9,
    },
    colaborador: null,
  },
];

describe('PericiasTable', () => {
  it('renders the required columns', () => {
    render(<PericiasTable items={items} />);
    expect(screen.getByText('0001234-56.2026.8.26.0100')).toBeInTheDocument();
    expect(screen.getByText('São Paulo/SP')).toBeInTheDocument();
    expect(screen.getByText('Carlos Lima')).toBeInTheDocument();
    expect(screen.getByText('Marcada')).toBeInTheDocument();
  });

  it('shows the autor x reu tooltip on hover over the processo number', async () => {
    const user = userEvent.setup();
    render(<PericiasTable items={items} />);
    await user.hover(screen.getByText('0001234-56.2026.8.26.0100'));
    expect(await screen.findByText('Maria Souza × João Pereira')).toBeInTheDocument();
  });

  it('shows a dash when there is no colaborador', () => {
    render(<PericiasTable items={items} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows a message when there are no items', () => {
    render(<PericiasTable items={[]} />);
    expect(screen.getByText('Nenhuma perícia encontrada.')).toBeInTheDocument();
  });
});
