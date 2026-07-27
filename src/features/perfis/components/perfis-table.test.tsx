import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PerfisTable } from './perfis-table';
import type { ActionResult } from '@/lib/action-result';

const updateProfileRole = vi.fn(async (..._args: unknown[]): Promise<ActionResult<null>> => ({
  success: true,
  data: null,
}));

vi.mock('../actions', () => ({
  updateProfileRole: (...args: unknown[]) => updateProfileRole(...args),
}));

describe('PerfisTable', () => {
  it('lists every profile with its current role', () => {
    render(
      <PerfisTable
        profiles={[{ id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'pendente' }]}
      />
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('ana@x.com')).toBeInTheDocument();
  });

  it('calls updateProfileRole when a new role is chosen', async () => {
    const user = userEvent.setup();
    render(
      <PerfisTable
        profiles={[{ id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'pendente' }]}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('gerencia'));

    expect(updateProfileRole).toHaveBeenCalledWith('u1', 'gerencia');
  });

  it('shows an error message when updateProfileRole fails', async () => {
    updateProfileRole.mockImplementationOnce(async () => ({
      success: false,
      error: 'Falha ao atualizar perfil',
    }));
    const user = userEvent.setup();
    render(
      <PerfisTable
        profiles={[{ id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'pendente' }]}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('gerencia'));

    expect(await screen.findByText('Falha ao atualizar perfil')).toBeInTheDocument();
  });
});
