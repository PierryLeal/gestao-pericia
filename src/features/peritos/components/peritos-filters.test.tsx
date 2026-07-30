import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritosFilters } from './peritos-filters';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

describe('PeritosFilters', () => {
  it('does not push a navigation on mount when nothing changed', async () => {
    params = new URLSearchParams();
    render(<PeritosFilters startTransition={(cb) => cb()} />);
    await new Promise((r) => setTimeout(r, 350));
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes the busca value after the user types and the debounce elapses', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PeritosFilters startTransition={(cb) => cb()} />);

    await user.type(screen.getByPlaceholderText('Nome'), 'Carlos');
    await new Promise((r) => setTimeout(r, 350));

    expect(push).toHaveBeenCalledWith('/peritos?busca=Carlos');
  });
});
