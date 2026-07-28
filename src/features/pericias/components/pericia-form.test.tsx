import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PericiaForm } from './pericia-form';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';

vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
}));

vi.mock('@/features/processos/components/processo-combobox', () => ({
  ProcessoCombobox: ({ onChange }: { onChange: (p: Processo) => void }) => (
    <button type="button" onClick={() => onChange({ id: 1, numero: 'P-1', autor: 'A', reu: 'B' })}>
      selecionar processo
    </button>
  ),
}));

vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({ onChange }: { onChange: (m: MunicipioIBGE) => void }) => (
    <button type="button" onClick={() => onChange({ id: 3550308, nome: 'São Paulo', uf: 'SP' })}>
      selecionar município
    </button>
  ),
}));

describe('PericiaForm', () => {
  it('calls onError when processo, municipio, or perito are missing', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={onError} />);

    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(onError).toHaveBeenCalledWith('Preencha processo, município e perito.');
  });

  it('calls onSaved with the id once processo, municipio, and perito are set', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={onSaved} onError={vi.fn()} />);

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.type(screen.getByLabelText('Data agendada'), '2026-08-01');
    await user.type(screen.getByLabelText('Hora agendada'), '14:30');
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(onSaved).toHaveBeenCalledWith(5);
  });
});
