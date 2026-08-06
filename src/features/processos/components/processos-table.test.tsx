import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProcessosTable } from './processos-table';
import type { Processo } from '../actions';

const items: Processo[] = [{ id: 1, numero: 'P-1', autor: 'A', reu: 'B', escritorio: 'PMRA' }];

describe('ProcessosTable', () => {
  it('calls onEdit when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ProcessosTable items={items} onEdit={onEdit} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /editar p-1/i }));

    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it('opens a confirmation dialog and calls onDelete when confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<ProcessosTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir p-1/i }));
    expect(screen.getByText(/excluir o processo "p-1"/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });

  it('does not call onDelete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<ProcessosTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir p-1/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows the escritorio column', () => {
    render(<ProcessosTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('PMRA')).toBeInTheDocument();
  });

  it('shows the total count and paginates at 30 per page', async () => {
    const muitos: Processo[] = Array.from({ length: 35 }, (_, i) => ({
      id: i + 1, numero: `P-${i + 1}`, autor: 'A', reu: 'B', escritorio: 'PMRA',
    }));
    const user = userEvent.setup();
    render(<ProcessosTable items={muitos} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('35 processos')).toBeInTheDocument();
    expect(screen.getByText('P-1')).toBeInTheDocument();
    expect(screen.queryByText('P-31')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    expect(screen.getByText('P-31')).toBeInTheDocument();
    expect(screen.queryByText('P-1')).not.toBeInTheDocument();
  });
});
