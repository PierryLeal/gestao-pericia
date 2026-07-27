import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from './sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('Sidebar', () => {
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
});
