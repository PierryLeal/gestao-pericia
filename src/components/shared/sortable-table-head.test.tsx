import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from './sortable-table-head';

function renderHead(direcao: 'asc' | 'desc' | null, onOrdenar = vi.fn()) {
  render(
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead label="Contrato" direcao={direcao} onOrdenar={onOrdenar} />
        </TableRow>
      </TableHeader>
    </Table>
  );
  return onOrdenar;
}

describe('SortableTableHead', () => {
  it('shows the column label', () => {
    renderHead(null);
    expect(screen.getByText('Contrato')).toBeInTheDocument();
  });

  it('calls onOrdenar with "asc" when the up arrow is clicked', async () => {
    const user = userEvent.setup();
    const onOrdenar = renderHead(null);

    await user.click(screen.getByRole('button', { name: 'Ordenar Contrato em ordem crescente' }));

    expect(onOrdenar).toHaveBeenCalledWith('asc');
  });

  it('calls onOrdenar with "desc" when the down arrow is clicked', async () => {
    const user = userEvent.setup();
    const onOrdenar = renderHead(null);

    await user.click(screen.getByRole('button', { name: 'Ordenar Contrato em ordem decrescente' }));

    expect(onOrdenar).toHaveBeenCalledWith('desc');
  });

  it('marks only the up arrow as pressed when direcao is "asc"', () => {
    renderHead('asc');
    expect(screen.getByRole('button', { name: 'Ordenar Contrato em ordem crescente' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ordenar Contrato em ordem decrescente' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks only the down arrow as pressed when direcao is "desc"', () => {
    renderHead('desc');
    expect(screen.getByRole('button', { name: 'Ordenar Contrato em ordem crescente' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Ordenar Contrato em ordem decrescente' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks neither arrow as pressed when direcao is null (default/unsorted)', () => {
    renderHead(null);
    expect(screen.getByRole('button', { name: 'Ordenar Contrato em ordem crescente' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Ordenar Contrato em ordem decrescente' })).toHaveAttribute('aria-pressed', 'false');
  });
});
