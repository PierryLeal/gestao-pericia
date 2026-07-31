import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EsqueciSenhaForm } from './esqueci-senha-form';

const mockRequestPasswordReset = vi.fn();
vi.mock('../actions', () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
}));

describe('EsqueciSenhaForm', () => {
  it('shows the generic confirmation message after submitting, regardless of the action outcome', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EsqueciSenhaForm />);

    await user.type(screen.getByLabelText('E-mail'), 'alguem@x.com');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    expect(mockRequestPasswordReset).toHaveBeenCalledWith('alguem@x.com');
    expect(
      await screen.findByText('Se esse e-mail existir, enviamos um link de recuperação.')
    ).toBeInTheDocument();
  });
});
