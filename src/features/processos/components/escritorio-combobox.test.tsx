import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EscritorioCombobox } from './escritorio-combobox';
import { listEscritoriosDistintos } from '../actions';

vi.mock('../actions', () => ({
  listEscritoriosDistintos: vi.fn(async () => ['CESCON', 'PMRA']),
}));

describe('EscritorioCombobox', () => {
  beforeEach(() => {
    vi.mocked(listEscritoriosDistintos).mockReset();
    vi.mocked(listEscritoriosDistintos).mockResolvedValue(['CESCON', 'PMRA']);
  });

  it('shows a loading state while options are still being fetched, not an immediate "not found"', async () => {
    let resolveFetch!: (v: string[]) => void;
    vi.mocked(listEscritoriosDistintos).mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    const user = userEvent.setup();
    render(<EscritorioCombobox value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum escritório encontrado.')).not.toBeInTheDocument();

    resolveFetch(['CESCON']);
    expect(await screen.findByText('CESCON')).toBeInTheDocument();
  });

  it('logs the error and falls back to an empty (not stuck-loading) list when the fetch fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const erro = new Error('boom');
    vi.mocked(listEscritoriosDistintos).mockRejectedValue(erro);
    const user = userEvent.setup();
    render(<EscritorioCombobox value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('Nenhum escritório encontrado.')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('Falha ao carregar escritórios', erro);
    consoleError.mockRestore();
  });

  it('warns when the fetch succeeds but returns an empty list, so that case is not confused with a swallowed error', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(listEscritoriosDistintos).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<EscritorioCombobox value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('Nenhum escritório encontrado.')).toBeInTheDocument();
    expect(consoleWarn).toHaveBeenCalledWith('listEscritoriosDistintos() retornou uma lista vazia (sem erro).');
    consoleWarn.mockRestore();
  });

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

  it('does not offer to create a duplicate when typed text matches an existing suggestion case-insensitively', async () => {
    const user = userEvent.setup();
    render(<EscritorioCombobox value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Buscar ou digitar escritório...'), 'pmra');

    expect(await screen.findByText('PMRA')).toBeInTheDocument();
    expect(screen.queryByText('Usar "pmra"')).not.toBeInTheDocument();
  });

  it('filters suggestions client-side as the user types', async () => {
    const user = userEvent.setup();
    render(<EscritorioCombobox value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Buscar ou digitar escritório...'), 'PM');

    expect(await screen.findByText('PMRA')).toBeInTheDocument();
    expect(screen.queryByText('CESCON')).not.toBeInTheDocument();
  });
});
