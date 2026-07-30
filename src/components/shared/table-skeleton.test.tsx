import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TableSkeleton } from './table-skeleton';

describe('TableSkeleton', () => {
  it('renders the requested number of rows and columns', () => {
    const { container } = render(<TableSkeleton headers={['A', 'B', 'C', 'D']} rows={3} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelectorAll('td')).toHaveLength(4);
  });

  it('defaults to 5 rows when rows is not specified', () => {
    const { container } = render(<TableSkeleton headers={['A', 'B']} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
  });

  it('renders the real header labels instead of a skeleton in the header row', () => {
    render(<TableSkeleton headers={['Nome', 'Contato']} />);
    expect(screen.getByRole('columnheader', { name: 'Nome' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Contato' })).toBeInTheDocument();
  });
});
