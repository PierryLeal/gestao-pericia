import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from './sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows Perfis for admin', () => {
    render(<Sidebar role="admin" />);
    expect(screen.getByText('Perfis')).toBeInTheDocument();
  });

  it('hides Perfis for gerencia', () => {
    render(<Sidebar role="gerencia" />);
    expect(screen.queryByText('Perfis')).not.toBeInTheDocument();
  });

  it('always shows Perícias, Peritos, and Colaboradores', () => {
    render(<Sidebar role="gerencia" />);
    expect(screen.getByText('Perícias')).toBeInTheDocument();
    expect(screen.getByText('Peritos')).toBeInTheDocument();
    expect(screen.getByText('Colaboradores')).toBeInTheDocument();
  });

  it('collapses on toggle click and hides labels', async () => {
    const user = userEvent.setup();
    render(<Sidebar role="admin" />);
    expect(screen.getByText('Peritos')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /recolher/i }));

    expect(screen.queryByText('Peritos')).not.toBeInTheDocument();
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');
  });

  it('restores collapsed state from localStorage on mount', () => {
    localStorage.setItem('sidebar-collapsed', 'true');
    render(<Sidebar role="admin" />);
    expect(screen.queryByText('Peritos')).not.toBeInTheDocument();
  });

  it('gives Sair and toggle buttons accessible names when collapsed', async () => {
    const user = userEvent.setup();
    render(<Sidebar role="admin" />);

    await user.click(screen.getByRole('button', { name: /recolher/i }));

    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument();
  });
});
