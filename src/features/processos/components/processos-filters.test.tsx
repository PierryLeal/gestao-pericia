import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProcessosFilters } from './processos-filters';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

describe('ProcessosFilters', () => {
  it('does not push a navigation on mount when nothing changed', async () => {
    params = new URLSearchParams();
    render(<ProcessosFilters startTransition={(cb) => cb()} />);
    await new Promise((r) => setTimeout(r, 350));
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes the busca value after the user types and the debounce elapses', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<ProcessosFilters startTransition={(cb) => cb()} />);

    await user.type(screen.getByPlaceholderText('Número, autor ou réu'), 'Souza');
    await new Promise((r) => setTimeout(r, 350));

    expect(push).toHaveBeenCalledWith('/processos?busca=Souza');
  });
});
