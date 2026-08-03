import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CalendarioFilters } from './calendario-filters';

describe('CalendarioFilters', () => {
  it('reports the busca text as the user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarioFilters peritos={[{ id: 1, nome: 'Cleber' }]} colaboradores={[]} onChange={onChange} />
    );

    await user.type(screen.getByLabelText('Processo'), '1234');

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ busca: '1234' })
    );
  });

  it('reports the selected perito id', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarioFilters peritos={[{ id: 1, nome: 'Cleber' }]} colaboradores={[]} onChange={onChange} />
    );

    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByRole('option', { name: 'Cleber' }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ peritoId: 1 }));
  });

  it('reports the selected situação', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarioFilters peritos={[]} colaboradores={[]} onChange={onChange} />
    );

    await user.click(screen.getByRole('combobox', { name: /situação/i }));
    await user.click(await screen.findByRole('option', { name: 'marcada' }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ situacao: 'marcada' }));
  });

  it('reports the selected colaborador id', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarioFilters peritos={[]} colaboradores={[{ id: 1, nome: 'Ana' }]} onChange={onChange} />
    );

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    await user.click(await screen.findByRole('option', { name: 'Ana' }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ colaboradorId: 1 }));
  });
});
