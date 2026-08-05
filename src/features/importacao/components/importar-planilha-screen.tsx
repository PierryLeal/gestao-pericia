'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  previewImportacaoPericias, confirmarImportacaoPericias,
} from '../actions';
import type { PericiaPreviewRow, NaoProcessada, RelatorioImportacaoPericias } from '../types';
import { PericiasPreviewTable } from './pericias-preview-table';

function pluralizar(quantidade: number, singular: string, plural: string): string {
  return quantidade === 1 ? singular : plural;
}

export function ImportarPlanilhaScreen() {
  const [linhas, setLinhas] = useState<PericiaPreviewRow[]>([]);
  const [naoProcessadas, setNaoProcessadas] = useState<NaoProcessada[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioImportacaoPericias | null>(null);
  const [processando, setProcessando] = useState(false);
  const [temPreview, setTemPreview] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRelatorio(null);
    setProcessando(true);
    try {
      const buffer = await file.arrayBuffer();
      const resultado = await previewImportacaoPericias(buffer);
      setLinhas(resultado.linhas);
      setNaoProcessadas(resultado.naoProcessadas);
      setTemPreview(true);
    } finally {
      setProcessando(false);
      e.target.value = '';
    }
  }

  async function handleConfirmar() {
    setProcessando(true);
    try {
      const resultado = await confirmarImportacaoPericias(linhas);
      setRelatorio(resultado);
      setLinhas([]);
      setTemPreview(false);
    } finally {
      setProcessando(false);
    }
  }

  const podeConfirmar = linhas.some((l) => l.status === 'ok' || l.status === 'atencao');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Importar planilha</h1>

      <div className="space-y-2">
        <Label htmlFor="upload-pericias">Planilha de Perícias e Processos</Label>
        <input id="upload-pericias" type="file" accept=".xlsx" onChange={handleUpload} disabled={processando} />
      </div>

      {temPreview && (
        <>
          <PericiasPreviewTable linhas={linhas} onChange={setLinhas} />
          <Button type="button" onClick={handleConfirmar} disabled={!podeConfirmar || processando}>
            Confirmar importação
          </Button>
        </>
      )}

      {naoProcessadas.length > 0 && (
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground">Linhas não processadas</h2>
          {naoProcessadas.map((n) => (
            <p key={n.linhaOriginal} className="text-sm">
              Linha {n.linhaOriginal}: &quot;<span>{n.texto}</span>&quot; — <span>{n.motivo}</span>
            </p>
          ))}
        </div>
      )}

      {relatorio && (
        <div className="rounded-md border p-4 text-sm">
          <p>
            {relatorio.processosCriados} {pluralizar(relatorio.processosCriados, 'processo criado', 'processos criados')},{' '}
            {relatorio.processosAtualizados} {pluralizar(relatorio.processosAtualizados, 'atualizado', 'atualizados')}.
          </p>
          <p>
            {relatorio.periciasCriadas} {pluralizar(relatorio.periciasCriadas, 'perícia criada', 'perícias criadas')}.
          </p>
          <p>
            {relatorio.peritosCriados} {pluralizar(relatorio.peritosCriados, 'perito criado', 'peritos criados')},{' '}
            {relatorio.colaboradoresCriados} {pluralizar(relatorio.colaboradoresCriados, 'colaborador criado', 'colaboradores criados')}.
          </p>
          <p>
            {relatorio.puladasPorDuplicidade} {pluralizar(relatorio.puladasPorDuplicidade, 'linha pulada', 'linhas puladas')} por duplicidade.
          </p>
        </div>
      )}
    </div>
  );
}
