import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('renders title and description when open', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Excluir perito"
        description="Excluir 'Carlos'? Essa ação não pode ser desfeita."
        onConfirm={vi.fn()}
        loading={false}
      />
    );
    expect(screen.getByText('Excluir perito')).toBeInTheDocument();
    expect(screen.getByText("Excluir 'Carlos'? Essa ação não pode ser desfeita.")).toBeInTheDocument();
  });

  it('calls onConfirm when the Excluir button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Excluir perito"
        description="..."
        onConfirm={onConfirm}
        loading={false}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onOpenChange(false) when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Excluir perito"
        description="..."
        onConfirm={vi.fn()}
        loading={false}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both buttons and shows "Excluindo..." while loading', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Excluir perito"
        description="..."
        onConfirm={vi.fn()}
        loading
      />
    );
    expect(screen.getByRole('button', { name: 'Excluindo...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});
