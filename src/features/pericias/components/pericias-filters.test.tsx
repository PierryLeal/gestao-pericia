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
    render(<PericiasFilters peritos={[]} colaboradores={[]} />);

    await new Promise((r) => setTimeout(r, 350));

    expect(push).not.toHaveBeenCalled();
  });

  it('pushes the new busca value after the user types and the debounce elapses', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} />);

    await user.type(screen.getByPlaceholderText('Buscar por número do processo'), 'P-1');
    await new Promise((r) => setTimeout(r, 350));

    expect(push).toHaveBeenCalledWith('/?busca=P-1');
  });

  it('pushes municipioId when a município is selected in the Local filter', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} />);

    await user.click(screen.getByText('selecionar município'));

    expect(push).toHaveBeenCalledWith(expect.stringContaining('municipioId=3550308'));
  });

  it('pushes peritoId when a perito is selected in the Perito filter', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[{ id: 1, nome: 'Carlos Lima' }]} colaboradores={[]} />);

    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos Lima'));

    expect(push).toHaveBeenCalledWith(expect.stringContaining('peritoId=1'));
  });

  it('pushes data when a date is picked', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} />);

    await user.type(screen.getByLabelText('Data'), '2026-08-01');

    expect(push).toHaveBeenCalledWith(expect.stringContaining('data=2026-08-01'));
  });

  it('clears data, municipioId, peritoId and colaboradorId when "Limpar filtros" is clicked', async () => {
    params = new URLSearchParams(
      'busca=P-1&situacao=Em+andamento&data=2026-08-01&municipioId=3550308&peritoId=1&colaboradorId=2'
    );
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} />);

    await user.click(screen.getByRole('button', { name: /limpar filtros/i }));

    expect(push).toHaveBeenCalledTimes(1);
    const pushedUrl = push.mock.calls[0][0] as string;
    expect(pushedUrl).not.toContain('data=');
    expect(pushedUrl).not.toContain('municipioId=');
    expect(pushedUrl).not.toContain('peritoId=');
    expect(pushedUrl).not.toContain('colaboradorId=');
  });
});
