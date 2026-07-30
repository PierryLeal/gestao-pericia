import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PericiasFilters } from './pericias-filters';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

describe('PericiasFilters', () => {
  it('does not push a navigation on mount when nothing changed', async () => {
    params = new URLSearchParams();
    render(<PericiasFilters />);

    await new Promise((r) => setTimeout(r, 350));

    expect(push).not.toHaveBeenCalled();
  });

  it('pushes the new busca value after the user types and the debounce elapses', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters />);

    await user.type(screen.getByPlaceholderText('Buscar por número do processo'), 'P-1');
    await new Promise((r) => setTimeout(r, 350));

    expect(push).toHaveBeenCalledWith('/?busca=P-1');
  });
});
