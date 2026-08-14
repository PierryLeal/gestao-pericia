import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ContratoFiltro } from './contrato-filtro';

vi.mock('@/features/pericias/actions', () => ({
  listContratosDistintos: vi.fn(async () => ['VALE AT', 'VALE BRUMADINHO']),
}));

describe('ContratoFiltro', () => {
  it('shows "Todos os contratos" when no value is selected', () => {
    render(<ContratoFiltro value="" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Todos os contratos');
  });

  it('calls onChange with the selected contrato', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContratoFiltro value="" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'VALE AT' }));

    expect(onChange).toHaveBeenCalledWith('VALE AT');
  });

  it('calls onChange with an empty string when "Todos os contratos" is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContratoFiltro value="VALE AT" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Todos os contratos' }));

    expect(onChange).toHaveBeenCalledWith('');
  });
});
