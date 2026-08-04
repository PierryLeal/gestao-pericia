import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProcessoForm } from './processo-form';

vi.mock('../actions', () => ({
  createProcesso: vi.fn(async (input: { numero: string; autor: string; reu: string; escritorio: string }) => ({
    success: true,
    data: { id: 1, ...input },
  })),
  updateProcesso: vi.fn(
    async (id: number, input: { numero: string; autor: string; reu: string; escritorio: string }) => ({
      success: true,
      data: { id, ...input },
    })
  ),
  listEscritoriosDistintos: vi.fn(async () => []),
}));

describe('ProcessoForm', () => {
  it('pre-fills fields when editing an existing processo', () => {
    render(
      <ProcessoForm
        processo={{ id: 5, numero: 'P-5', autor: 'Ana', reu: 'Bia', escritorio: 'PMRA' }}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Número do processo')).toHaveValue('P-5');
    expect(screen.getByLabelText('Autor')).toHaveValue('Ana');
    expect(screen.getByLabelText('Réu')).toHaveValue('Bia');
    expect(screen.getByRole('combobox')).toHaveTextContent('PMRA');
  });

  it('calls updateProcesso and onSaved when editing', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <ProcessoForm
        processo={{ id: 5, numero: 'P-5', autor: 'Ana', reu: 'Bia', escritorio: 'PMRA' }}
        onSaved={onSaved}
        onError={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: /salvar processo/i }));
    expect(onSaved).toHaveBeenCalledWith({ id: 5, numero: 'P-5', autor: 'Ana', reu: 'Bia', escritorio: 'PMRA' });
  });
});
