import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PaginationControls } from './pagination-controls';

describe('PaginationControls', () => {
  it('shows the total with its label', () => {
    render(<PaginationControls paginaAtual={1} totalPaginas={3} total={62} rotulo="processos" onPageChange={vi.fn()} />);
    expect(screen.getByText('62 processos')).toBeInTheDocument();
  });

  it('hides the prev/next controls when everything fits on one page', () => {
    render(<PaginationControls paginaAtual={1} totalPaginas={1} total={5} rotulo="itens" onPageChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima' })).not.toBeInTheDocument();
  });

  it('disables "Anterior" on the first page and "Próxima" on the last', () => {
    const { rerender } = render(
      <PaginationControls paginaAtual={1} totalPaginas={3} total={62} rotulo="processos" onPageChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).not.toBeDisabled();

    rerender(<PaginationControls paginaAtual={3} totalPaginas={3} total={62} rotulo="processos" onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });

  it('calls onPageChange with the adjacent page number', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PaginationControls paginaAtual={2} totalPaginas={3} total={62} rotulo="processos" onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
