import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ContratoFiltro, parseContratos, serializeContratos } from './contrato-filtro';

vi.mock('@/features/pericias/actions', () => ({
  listContratosDistintos: vi.fn(async () => ['VALE AT', 'VALE BRUMADINHO']),
}));

describe('ContratoFiltro', () => {
  it('shows "Todos os contratos" when no value is selected', () => {
    render(<ContratoFiltro value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Todos os contratos');
  });

  it('shows the contrato name directly when exactly one is selected', () => {
    render(<ContratoFiltro value={['VALE AT']} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('VALE AT');
  });

  it('shows a count when more than one contrato is selected', () => {
    render(<ContratoFiltro value={['VALE AT', 'VALE BRUMADINHO']} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('2 contratos selecionados');
  });

  it('adds a contrato to the selection when picked (without removing others)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContratoFiltro value={['VALE AT']} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'VALE BRUMADINHO' }));

    expect(onChange).toHaveBeenCalledWith(['VALE AT', 'VALE BRUMADINHO']);
  });

  it('removes a contrato from the selection when it is picked again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContratoFiltro value={['VALE AT', 'VALE BRUMADINHO']} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'VALE AT' }));

    expect(onChange).toHaveBeenCalledWith(['VALE BRUMADINHO']);
  });

  it('clears the whole selection via "Limpar seleção"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContratoFiltro value={['VALE AT']} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('button', { name: 'Limpar seleção' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('does not show "Limpar seleção" when nothing is selected', async () => {
    const user = userEvent.setup();
    render(<ContratoFiltro value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));

    expect(screen.queryByRole('button', { name: 'Limpar seleção' })).not.toBeInTheDocument();
  });
});

describe('serializeContratos / parseContratos', () => {
  it('round-trips a list of contratos through a comma-joined URL param value', () => {
    const serializado = serializeContratos(['VALE AT', 'VALE BRUMADINHO']);
    expect(serializado).toBe('VALE AT,VALE BRUMADINHO');
    expect(parseContratos(serializado)).toEqual(['VALE AT', 'VALE BRUMADINHO']);
  });

  it('parses null/undefined/empty as an empty list', () => {
    expect(parseContratos(null)).toEqual([]);
    expect(parseContratos(undefined)).toEqual([]);
    expect(parseContratos('')).toEqual([]);
  });

  it('trims whitespace and drops empty segments from a stray/doubled comma', () => {
    expect(parseContratos('VALE AT, , VALE BRUMADINHO,')).toEqual(['VALE AT', 'VALE BRUMADINHO']);
  });

  it('serializes an empty list as an empty string', () => {
    expect(serializeContratos([])).toBe('');
  });
});
