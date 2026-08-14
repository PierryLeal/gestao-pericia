'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatarNumeroProcesso } from '@/lib/processo-numero-provisorio';
import { listPericias } from '../actions';

const SITUACAO_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  marcada: 'Marcada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export function ExportPericiasButton() {
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const filters: Parameters<typeof listPericias>[0] = {};
      const situacao = searchParams.get('situacao');
      const busca = searchParams.get('busca');
      const dataInicio = searchParams.get('dataInicio');
      const dataFim = searchParams.get('dataFim');
      const municipioId = searchParams.get('municipioId');
      const peritoId = searchParams.get('peritoId');
      const colaboradorId = searchParams.get('colaboradorId');
      const contrato = searchParams.get('contrato');
      if (situacao) filters.situacao = situacao;
      if (busca) filters.busca = busca;
      if (dataInicio) filters.dataInicio = dataInicio;
      if (dataFim) filters.dataFim = dataFim;
      if (municipioId) filters.municipioId = Number(municipioId);
      if (peritoId) filters.peritoId = Number(peritoId);
      if (colaboradorId) filters.colaboradorId = Number(colaboradorId);
      if (contrato) filters.contrato = contrato;

      const items = await listPericias(filters);
      if (items.length === 0) {
        toast.info('Nenhuma perícia para exportar com os filtros atuais.');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Perícias');
      worksheet.columns = [
        { header: 'Nº Processo', key: 'numero', width: 20 },
        { header: 'Autor', key: 'autor', width: 22 },
        { header: 'Réu', key: 'reu', width: 22 },
        { header: 'Data', key: 'data', width: 14 },
        { header: 'Hora', key: 'hora', width: 10 },
        { header: 'Local', key: 'local', width: 22 },
        { header: 'Perito', key: 'perito', width: 22 },
        { header: 'Colaborador', key: 'colaborador', width: 22 },
        { header: 'Situação', key: 'situacao', width: 14 },
      ];
      worksheet.getRow(1).font = { bold: true };
      worksheet.addRows(
        items.map((item) => ({
          numero: formatarNumeroProcesso(item.processo?.numero),
          autor: item.processo?.autor ?? '',
          reu: item.processo?.reu ?? '',
          data: item.dataAgendada ? new Date(item.dataAgendada) : '',
          hora: item.horaAgendada ?? '',
          local: item.municipio ? `${item.municipio.nome}/${item.municipio.uf}` : '',
          perito: item.perito?.nome ?? '',
          colaborador: item.colaboradores.map((c) => c.nome).join('/'),
          situacao: SITUACAO_LABELS[item.situacao] ?? item.situacao,
        }))
      );

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `pericias-${today}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Planilha exportada');
    } catch {
      toast.error('Não foi possível exportar as perícias.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
      <FileSpreadsheet className="size-4" />
      {exporting ? 'Exportando...' : 'Exportar Excel'}
    </Button>
  );
}
