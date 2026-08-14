import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ContratoCombobox } from './contrato-combobox';

vi.mock('../actions', () => ({
  listContratosDistintos: vi.fn(async () => ['VALE AT', 'VALE BRUMADINHO']),
}));

describe('ContratoCombobox', () => {
  it('shows existing suggestions and calls onChange when one is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContratoCombobox value={null} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('VALE BRUMADINHO'));

    expect(onChange).toHaveBeenCalledWith('VALE BRUMADINHO');
  });

  it('offers to use a freshly typed value that matches no suggestion', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContratoCombobox value={null} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Buscar ou digitar contrato...'), 'ANGLO');
    await user.click(await screen.findByText('Usar "ANGLO"'));

    expect(onChange).toHaveBeenCalledWith('ANGLO');
  });

  it('shows the current value in the trigger', async () => {
    render(<ContratoCombobox value="VALE AT" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('VALE AT');
  });

  it('shows a placeholder in the trigger when no contrato is set', async () => {
    render(<ContratoCombobox value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Selecione um contrato');
  });

  it('offers to clear the selection with onChange(null), only when a value is set', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContratoCombobox value="VALE AT" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Sem contrato'));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('does not offer a clear option when there is no current value', async () => {
    const user = userEvent.setup();
    render(<ContratoCombobox value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));

    expect(screen.queryByText('Sem contrato')).not.toBeInTheDocument();
  });
});
