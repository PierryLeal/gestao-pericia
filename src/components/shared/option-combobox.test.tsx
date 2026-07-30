import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { OptionCombobox } from './option-combobox';

const options = [
  { id: 1, nome: 'Carlos Lima' },
  { id: 2, nome: 'Diana Souza' },
];

describe('OptionCombobox', () => {
  it('shows the placeholder when nothing is selected', () => {
    render(<OptionCombobox options={options} value={null} onChange={vi.fn()} placeholder="Selecione um perito" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Selecione um perito');
  });

  it('shows the selected option name', () => {
    render(<OptionCombobox options={options} value={1} onChange={vi.fn()} placeholder="Selecione um perito" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Carlos Lima');
  });

  it('calls onChange with the id of the option the user picks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OptionCombobox options={options} value={null} onChange={onChange} placeholder="Selecione um perito" />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Diana Souza'));

    expect(onChange).toHaveBeenCalledWith(2);
  });
});
