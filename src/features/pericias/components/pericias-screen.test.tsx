import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PericiasScreen } from './pericias-screen';
import type { PericiaListItem } from '../actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 9 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 1 } })),
}));

vi.mock('@/features/processos/components/processo-combobox', () => ({
  ProcessoCombobox: ({ selected }: { selected: { numero: string } | null }) => (
    <span>{selected ? selected.numero : 'processo vazio'}</span>
  ),
}));

vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({ selected }: { selected: { nome: string } | null }) => (
    <span>{selected ? selected.nome : 'municipio vazio'}</span>
  ),
}));

const items: PericiaListItem[] = [
  {
    id: 1,
    dataAgendada: '2026-08-01',
    horaAgendada: '14:30',
    situacao: 'marcada',
    processo: { id: 1, numero: 'P-1', autor: 'A', reu: 'B' },
    municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
    perito: { id: 1, nome: 'Carlos', contato: '', formacao: '', crea: '', jaTrabalhamos: false, relacao: 0, resultados: 0 },
    colaborador: null,
  },
];

describe('PericiasScreen', () => {
  it('opens the edit dialog pre-filled after fetching the full record', async () => {
    const user = userEvent.setup();
    const getPericiaForEdit = vi.fn(async () => ({
      id: 1,
      processoId: 1,
      municipioId: 3550308,
      peritoId: 1,
      colaboradorId: null,
      dataAgendada: '2026-08-01',
      horaAgendada: '14:30',
      situacao: 'marcada' as const,
      processo: { id: 1, numero: 'P-1', autor: 'A', reu: 'B' },
      municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
    }));

    render(
      <PericiasScreen
        items={items}
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[]}
        getPericiaForEdit={getPericiaForEdit}
      />
    );

    await user.click(screen.getByRole('button', { name: /editar perícia/i }));

    expect(getPericiaForEdit).toHaveBeenCalledWith(1);
    const heading = await screen.findByRole('heading', { name: 'Editar perícia' });
    expect(heading).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('P-1')).toBeInTheDocument();
  });

  it('shows an error toast and does not open the dialog when the record cannot be loaded', async () => {
    const user = userEvent.setup();
    const getPericiaForEdit = vi.fn(async () => null);

    render(
      <PericiasScreen
        items={items}
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[]}
        getPericiaForEdit={getPericiaForEdit}
      />
    );

    await user.click(screen.getByRole('button', { name: /editar perícia/i }));

    expect(getPericiaForEdit).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('heading', { name: 'Editar perícia' })).not.toBeInTheDocument();
  });
});
