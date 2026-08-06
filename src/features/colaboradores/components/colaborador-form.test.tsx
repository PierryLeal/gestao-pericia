import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColaboradorForm } from './colaborador-form';

vi.mock('../actions', () => ({
  createColaborador: vi.fn(async () => ({ success: false, error: 'Nome é obrigatório' })),
  updateColaborador: vi.fn(),
}));

describe('ColaboradorForm', () => {
  it('calls onError with the message returned by the action when validation fails', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<ColaboradorForm onSaved={vi.fn()} onError={onError} />);

    await user.click(screen.getByRole('button', { name: /salvar colaborador/i }));

    expect(onError).toHaveBeenCalledWith('Nome é obrigatório');
  });

  it('pre-fills fields when editing an existing colaborador', () => {
    render(
      <ColaboradorForm
        colaborador={{ id: 1, nome: 'Bruna', contato: '11988887777', formacao: 'Direito', email: 'bruna@exemplo.com' }}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Nome')).toHaveValue('Bruna');
    expect(screen.getByLabelText('E-mail')).toHaveValue('bruna@exemplo.com');
  });

  it('pre-fills an empty email as a blank field when the colaborador has none', () => {
    render(
      <ColaboradorForm
        colaborador={{ id: 1, nome: 'Bruna', contato: '', formacao: '', email: null }}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByLabelText('E-mail')).toHaveValue('');
  });

  it('formats the contato field as the user types', async () => {
    const user = userEvent.setup();
    render(<ColaboradorForm onSaved={vi.fn()} onError={vi.fn()} />);

    await user.type(screen.getByLabelText('Contato'), '11999998888');

    expect(screen.getByLabelText('Contato')).toHaveValue('(11) 99999-8888');
  });

  it('does not truncate an over-length existing contato value on mount', () => {
    render(
      <ColaboradorForm
        colaborador={{ id: 1, nome: 'Bruna', contato: '5511999998888888', formacao: 'Direito', email: null }}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Contato')).toHaveValue('5511999998888888');
  });
});
