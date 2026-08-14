import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NovoProcessoDialog } from './novo-processo-dialog';

vi.mock('../actions', () => ({
  createProcesso: vi.fn(
    async (input: { numero: string; autor: string; reu: string; escritorio: string }) => ({
      success: true,
      data: { id: 42, ...input },
    })
  ),
  listEscritoriosDistintos: vi.fn(async () => []),
}));

describe('NovoProcessoDialog', () => {
  it('calls onCreated with the new processo and closes on success', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();

    render(<NovoProcessoDialog open onOpenChange={onOpenChange} onCreated={onCreated} />);

    await user.type(screen.getByLabelText('Número do processo'), '0001234-56.2026.8.26.0100');
    await user.type(screen.getByLabelText('Autor'), 'Maria Souza');
    await user.type(screen.getByLabelText('Réu'), 'João Pereira');
    await user.click(screen.getByRole('combobox', { name: /escritório/i }));
    await user.type(screen.getByPlaceholderText('Buscar ou digitar escritório...'), 'PMRA');
    await user.click(await screen.findByText('Usar "PMRA"'));
    await user.click(screen.getByRole('button', { name: /salvar e vincular/i }));

    expect(onCreated).toHaveBeenCalledWith({
      id: 42,
      numero: '0001234-56.2026.8.26.0100',
      autor: 'Maria Souza',
      reu: 'João Pereira',
      escritorio: 'PMRA',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
