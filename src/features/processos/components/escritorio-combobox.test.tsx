import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EscritorioCombobox } from './escritorio-combobox';

vi.mock('../actions', () => ({
  listEscritoriosDistintos: vi.fn(async () => ['CESCON', 'PMRA']),
}));

describe('EscritorioCombobox', () => {
  it('shows existing suggestions and calls onChange when one is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EscritorioCombobox value="" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('PMRA'));

    expect(onChange).toHaveBeenCalledWith('PMRA');
  });

  it('offers to use a freshly typed value that matches no suggestion', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EscritorioCombobox value="" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Buscar ou digitar escritório...'), 'Novo Escritório');
    await user.click(await screen.findByText('Usar "Novo Escritório"'));

    expect(onChange).toHaveBeenCalledWith('Novo Escritório');
  });

  it('shows the current value in the trigger', async () => {
    render(<EscritorioCombobox value="PMRA" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('PMRA');
  });
});
