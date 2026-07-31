import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PericiasFilters } from './pericias-filters';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({ onChange }: { onChange: (m: { id: number; nome: string; uf: string }) => void }) => (
    <button type="button" onClick={() => onChange({ id: 3550308, nome: 'São Paulo', uf: 'SP' })}>
      selecionar município
    </button>
  ),
}));

describe('PericiasFilters', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('does not push a navigation on mount when nothing changed', async () => {
    params = new URLSearchParams();
    render(<PericiasFilters peritos={[]} colaboradores={[]} municipio={null} startTransition={(cb) => cb()} />);

    await new Promise((r) => setTimeout(r, 350));

    expect(push).not.toHaveBeenCalled();
  });

  it('pushes the new busca value after the user types and the debounce elapses', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} municipio={null} startTransition={(cb) => cb()} />);

    await user.type(screen.getByPlaceholderText('Número do processo'), 'P-1');
    await new Promise((r) => setTimeout(r, 350));

    expect(push).toHaveBeenCalledWith('/?busca=P-1');
  });

  it('pushes municipioId when a município is selected in the Local filter', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} municipio={null} startTransition={(cb) => cb()} />);

    await user.click(screen.getByText('selecionar município'));

    expect(push).toHaveBeenCalledWith(expect.stringContaining('municipioId=3550308'));
  });

  it('pushes peritoId when a perito is selected in the Perito filter', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[{ id: 1, nome: 'Carlos Lima' }]} colaboradores={[]} municipio={null} startTransition={(cb) => cb()} />);

    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos Lima'));

    expect(push).toHaveBeenCalledWith(expect.stringContaining('peritoId=1'));
  });

  it('pushes dataInicio when the start date is picked', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} municipio={null} startTransition={(cb) => cb()} />);

    await user.type(screen.getByLabelText('Data inicial'), '2026-08-01');

    expect(push).toHaveBeenCalledWith(expect.stringContaining('dataInicio=2026-08-01'));
  });

  it('pushes dataFim when the end date is picked', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} municipio={null} startTransition={(cb) => cb()} />);

    await user.type(screen.getByLabelText('Data final'), '2026-08-10');

    expect(push).toHaveBeenCalledWith(expect.stringContaining('dataFim=2026-08-10'));
  });

  it('clears data, municipioId, peritoId and colaboradorId when "Limpar filtros" is clicked', async () => {
    params = new URLSearchParams(
      'busca=P-1&situacao=Em+andamento&dataInicio=2026-08-01&dataFim=2026-08-05&municipioId=3550308&peritoId=1&colaboradorId=2'
    );
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} municipio={null} startTransition={(cb) => cb()} />);

    await user.click(screen.getByRole('button', { name: /limpar filtros/i }));

    expect(push).toHaveBeenCalledTimes(1);
    const pushedUrl = push.mock.calls[0][0] as string;
    expect(pushedUrl).not.toContain('dataInicio=');
    expect(pushedUrl).not.toContain('dataFim=');
    expect(pushedUrl).not.toContain('municipioId=');
    expect(pushedUrl).not.toContain('peritoId=');
    expect(pushedUrl).not.toContain('colaboradorId=');
  });
});
