import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColaboradoresTable } from './colaboradores-table';
import type { Colaborador } from '../actions';

const items: Colaborador[] = [{ id: 1, nome: 'Bruna Souza', contato: '', formacao: '', interno: true }];

describe('ColaboradoresTable', () => {
  it('calls onEdit when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ColaboradoresTable items={items} onEdit={onEdit} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /editar bruna souza/i }));

    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it('opens a confirmation dialog and calls onDelete when confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<ColaboradoresTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir bruna souza/i }));
    expect(screen.getByText(/excluir "bruna souza"/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });

  it('does not call onDelete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<ColaboradoresTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir bruna souza/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
  });
});
