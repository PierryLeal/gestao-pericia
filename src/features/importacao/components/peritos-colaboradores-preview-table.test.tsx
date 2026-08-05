import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritosColaboradoresPreviewTable } from './peritos-colaboradores-preview-table';
import type { ColaboradorPreviewRow, PeritoPreviewRow } from '../types';

function colaboradorBase(overrides: Partial<ColaboradorPreviewRow> = {}): ColaboradorPreviewRow {
  return { linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '31999990000', idExistente: null, ...overrides };
}

function peritoBase(overrides: Partial<PeritoPreviewRow> = {}): PeritoPreviewRow {
  return {
    linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Carlos', contato: '31988880000',
    formacao: 'Eng. Civil', crea: 'CREA-123', documento: '111.222.333-44',
    jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo', idExistente: null,
    ...overrides,
  };
}

describe('PeritosColaboradoresPreviewTable', () => {
  it('shows colaborador rows in one table and perito rows in another', () => {
    render(
      <PeritosColaboradoresPreviewTable
        colaboradores={[colaboradorBase()]}
        peritos={[peritoBase()]}
        onChangeColaboradores={vi.fn()}
        onChangePeritos={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('Ana')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Carlos')).toBeInTheDocument();
  });

  it('lets the user edit a flagged relação via the select', async () => {
    const user = userEvent.setup();
    const onChangePeritos = vi.fn();
    render(
      <PeritosColaboradoresPreviewTable
        colaboradores={[]}
        peritos={[peritoBase({ status: 'atencao', motivo: 'relação não reconhecida' })]}
        onChangeColaboradores={vi.fn()}
        onChangePeritos={onChangePeritos}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /relação/i }));
    await user.click(await screen.findByRole('option', { name: 'otima' }));

    expect(onChangePeritos).toHaveBeenCalledWith([expect.objectContaining({ relacao: 'otima' })]);
  });
});
