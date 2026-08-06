import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColaboradoresTable } from './colaboradores-table';
import type { Colaborador } from '../actions';

const items: Colaborador[] = [
  { id: 1, nome: 'Bruna Souza', contato: '', formacao: '', email: 'bruna@exemplo.com' },
];

describe('ColaboradoresTable', () => {
  it('calls onEdit when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ColaboradoresTable items={items} onEdit={onEdit} onDelete={vi.fn()} onMerge={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /editar bruna souza/i }));

    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it('calls onMerge when the merge icon is clicked', async () => {
    const user = userEvent.setup();
    const onMerge = vi.fn();
    render(<ColaboradoresTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} onMerge={onMerge} />);

    await user.click(screen.getByRole('button', { name: /mesclar bruna souza com outro colaborador/i }));

    expect(onMerge).toHaveBeenCalledWith(items[0]);
  });

  it('shows the email column', () => {
    render(<ColaboradoresTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} onMerge={vi.fn()} />);
    expect(screen.getByText('bruna@exemplo.com')).toBeInTheDocument();
  });

  it('opens a confirmation dialog and calls onDelete when confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<ColaboradoresTable items={items} onEdit={vi.fn()} onDelete={onDelete} onMerge={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /excluir bruna souza/i }));
    expect(screen.getByText(/excluir "bruna souza"/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });

  it('does not call onDelete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<ColaboradoresTable items={items} onEdit={vi.fn()} onDelete={onDelete} onMerge={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /excluir bruna souza/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows the total count and paginates at 30 per page', async () => {
    const muitos: Colaborador[] = Array.from({ length: 35 }, (_, i) => ({
      id: i + 1, nome: `Colaborador ${i + 1}`, contato: '', formacao: '', email: null,
    }));
    const user = userEvent.setup();
    render(<ColaboradoresTable items={muitos} onEdit={vi.fn()} onDelete={vi.fn()} onMerge={vi.fn()} />);

    expect(screen.getByText('35 colaboradores')).toBeInTheDocument();
    expect(screen.getByText('Colaborador 1')).toBeInTheDocument();
    expect(screen.queryByText('Colaborador 31')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    expect(screen.getByText('Colaborador 31')).toBeInTheDocument();
    expect(screen.queryByText('Colaborador 1')).not.toBeInTheDocument();
  });
});
