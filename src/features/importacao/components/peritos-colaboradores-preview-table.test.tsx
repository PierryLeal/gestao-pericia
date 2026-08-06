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

  it('gives every perito row the same number of cells as the perito header has columns, flagged or not', () => {
    render(
      <PeritosColaboradoresPreviewTable
        colaboradores={[]}
        peritos={[
          peritoBase({ linhaOriginal: 2 }),
          peritoBase({ linhaOriginal: 3, status: 'atencao', motivo: 'relação não reconhecida' }),
        ]}
        onChangeColaboradores={vi.fn()}
        onChangePeritos={vi.fn()}
      />
    );

    const tabelaPeritos = screen.getAllByRole('table').at(-1) as HTMLElement;
    const colunas = tabelaPeritos.querySelectorAll('thead th');
    const linhasDoCorpo = tabelaPeritos.querySelectorAll('tbody tr');
    expect(linhasDoCorpo).toHaveLength(2);
    for (const linha of linhasDoCorpo) {
      expect(linha.querySelectorAll('td')).toHaveLength(colunas.length);
    }
    expect(colunas[colunas.length - 2]).toHaveTextContent('Motivo');
  });

  it('removes a colaborador row when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const onChangeColaboradores = vi.fn();
    render(
      <PeritosColaboradoresPreviewTable
        colaboradores={[colaboradorBase({ linhaOriginal: 2 }), colaboradorBase({ linhaOriginal: 3, nome: 'Beatriz' })]}
        peritos={[]}
        onChangeColaboradores={onChangeColaboradores}
        onChangePeritos={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /remover linha 2/i }));

    expect(onChangeColaboradores).toHaveBeenCalledWith([expect.objectContaining({ linhaOriginal: 3 })]);
  });

  it('removes a perito row when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const onChangePeritos = vi.fn();
    render(
      <PeritosColaboradoresPreviewTable
        colaboradores={[]}
        peritos={[peritoBase({ linhaOriginal: 2 }), peritoBase({ linhaOriginal: 3, nome: 'Daniel' })]}
        onChangeColaboradores={vi.fn()}
        onChangePeritos={onChangePeritos}
      />
    );

    await user.click(screen.getByRole('button', { name: /remover linha 2/i }));

    expect(onChangePeritos).toHaveBeenCalledWith([expect.objectContaining({ linhaOriginal: 3 })]);
  });
});
