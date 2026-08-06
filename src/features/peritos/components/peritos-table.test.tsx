import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritosTable } from './peritos-table';
import type { Perito } from '../actions';

const items: Perito[] = [
  {
    id: 1, nome: 'Carlos Lima', contato: '', formacao: '', crea: '', documento: '',
    jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial',
  },
];

describe('PeritosTable', () => {
  it('calls onEdit when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<PeritosTable items={items} onEdit={onEdit} onDelete={vi.fn()} onMerge={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /editar carlos lima/i }));

    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it('calls onMerge when the merge icon is clicked', async () => {
    const user = userEvent.setup();
    const onMerge = vi.fn();
    render(<PeritosTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} onMerge={onMerge} />);

    await user.click(screen.getByRole('button', { name: /mesclar carlos lima com outro perito/i }));

    expect(onMerge).toHaveBeenCalledWith(items[0]);
  });

  it('opens a confirmation dialog and calls onDelete when confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<PeritosTable items={items} onEdit={vi.fn()} onDelete={onDelete} onMerge={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /excluir carlos lima/i }));
    expect(screen.getByText(/excluir "carlos lima"/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });

  it('does not call onDelete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<PeritosTable items={items} onEdit={vi.fn()} onDelete={onDelete} onMerge={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /excluir carlos lima/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/excluir "carlos lima"/i)).not.toBeInTheDocument();
  });

  it('shows the total count and paginates at 30 per page', async () => {
    const muitos: Perito[] = Array.from({ length: 35 }, (_, i) => ({
      id: i + 1, nome: `Perito ${i + 1}`, contato: '', formacao: '', crea: '', documento: '',
      jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial',
    }));
    const user = userEvent.setup();
    render(<PeritosTable items={muitos} onEdit={vi.fn()} onDelete={vi.fn()} onMerge={vi.fn()} />);

    expect(screen.getByText('35 peritos')).toBeInTheDocument();
    expect(screen.getByText('Perito 1')).toBeInTheDocument();
    expect(screen.queryByText('Perito 31')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    expect(screen.getByText('Perito 31')).toBeInTheDocument();
    expect(screen.queryByText('Perito 1')).not.toBeInTheDocument();
  });
});
