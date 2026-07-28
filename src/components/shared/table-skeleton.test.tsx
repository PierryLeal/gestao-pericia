import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TableSkeleton } from './table-skeleton';

describe('TableSkeleton', () => {
  it('renders the requested number of rows and columns', () => {
    const { container } = render(<TableSkeleton columns={4} rows={3} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelectorAll('td')).toHaveLength(4);
  });

  it('defaults to 5 rows when rows is not specified', () => {
    const { container } = render(<TableSkeleton columns={2} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
  });
});
