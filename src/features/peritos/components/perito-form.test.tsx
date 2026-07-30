import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritoForm } from './perito-form';

vi.mock('../actions', () => ({
  createPerito: vi.fn(async () => ({ success: false, error: 'Nome é obrigatório' })),
  updatePerito: vi.fn(),
}));

describe('PeritoForm', () => {
  it('calls onError with the message returned by the action when validation fails', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<PeritoForm onSaved={vi.fn()} onError={onError} />);

    await user.click(screen.getByRole('button', { name: /salvar perito/i }));

    expect(onError).toHaveBeenCalledWith('Nome é obrigatório');
  });

  it('pre-fills fields when editing an existing perito', () => {
    render(
      <PeritoForm
        perito={{
          id: 1, nome: 'Carlos', contato: '11999999999', formacao: 'Eng.', crea: '123',
          documento: '000', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
        }}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Nome')).toHaveValue('Carlos');
    expect(screen.getByRole('combobox', { name: /relação/i })).toHaveTextContent('Boa');
    expect(screen.getByRole('combobox', { name: /resultado/i })).toHaveTextContent('Positivo');
  });
});
