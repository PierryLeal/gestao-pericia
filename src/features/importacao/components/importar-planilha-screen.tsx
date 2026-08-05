'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  previewImportacaoPericias, confirmarImportacaoPericias,
  previewImportacaoPeritosColaboradores, confirmarImportacaoPeritosColaboradores,
} from '../actions';
import type {
  PericiaPreviewRow, NaoProcessada, RelatorioImportacaoPericias,
  ColaboradorPreviewRow, PeritoPreviewRow, RelatorioImportacaoPeritosColaboradores,
} from '../types';
import { PericiasPreviewTable } from './pericias-preview-table';
import { PeritosColaboradoresPreviewTable } from './peritos-colaboradores-preview-table';

function pluralizar(quantidade: number, singular: string, plural: string): string {
  return quantidade === 1 ? singular : plural;
}

export function ImportarPlanilhaScreen() {
  const [linhas, setLinhas] = useState<PericiaPreviewRow[]>([]);
  const [naoProcessadas, setNaoProcessadas] = useState<NaoProcessada[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioImportacaoPericias | null>(null);
  const [processandoPericias, setProcessandoPericias] = useState(false);
  const [temPreviewPericias, setTemPreviewPericias] = useState(false);

  const [colaboradores, setColaboradores] = useState<ColaboradorPreviewRow[]>([]);
  const [peritos, setPeritos] = useState<PeritoPreviewRow[]>([]);
  const [naoProcessadasPeritos, setNaoProcessadasPeritos] = useState<NaoProcessada[]>([]);
  const [relatorioPeritos, setRelatorioPeritos] = useState<RelatorioImportacaoPeritosColaboradores | null>(null);
  const [processandoPeritos, setProcessandoPeritos] = useState(false);
  const [temPreviewPeritos, setTemPreviewPeritos] = useState(false);

  async function handleUploadPericias(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRelatorio(null);
    setProcessandoPericias(true);
    try {
      const buffer = await file.arrayBuffer();
      const resultado = await previewImportacaoPericias(buffer);
      setLinhas(resultado.linhas);
      setNaoProcessadas(resultado.naoProcessadas);
      setTemPreviewPericias(true);
    } finally {
      setProcessandoPericias(false);
      e.target.value = '';
    }
  }

  async function handleConfirmarPericias() {
    setProcessandoPericias(true);
    try {
      const resultado = await confirmarImportacaoPericias(linhas);
      setRelatorio(resultado);
      setLinhas([]);
      setTemPreviewPericias(false);
    } finally {
      setProcessandoPericias(false);
    }
  }

  async function handleUploadPeritos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRelatorioPeritos(null);
    setProcessandoPeritos(true);
    try {
      const buffer = await file.arrayBuffer();
      const resultado = await previewImportacaoPeritosColaboradores(buffer);
      setColaboradores(resultado.colaboradores);
      setPeritos(resultado.peritos);
      setNaoProcessadasPeritos(resultado.naoProcessadas);
      setTemPreviewPeritos(true);
    } finally {
      setProcessandoPeritos(false);
      e.target.value = '';
    }
  }

  async function handleConfirmarPeritos() {
    setProcessandoPeritos(true);
    try {
      const resultado = await confirmarImportacaoPeritosColaboradores(colaboradores, peritos);
      setRelatorioPeritos(resultado);
      setColaboradores([]);
      setPeritos([]);
      setTemPreviewPeritos(false);
    } finally {
      setProcessandoPeritos(false);
    }
  }

  const podeConfirmarPericias = linhas.some((l) => l.status === 'ok' || l.status === 'atencao');
  const podeConfirmarPeritos = colaboradores.length > 0 || peritos.length > 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Importar planilha</h1>

      <Tabs defaultValue="pericias">
        <TabsList>
          <TabsTrigger value="pericias">Perícias e Processos</TabsTrigger>
          <TabsTrigger value="peritos">Peritos e Colaboradores</TabsTrigger>
        </TabsList>

        <TabsContent value="pericias" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="upload-pericias">Planilha de Perícias e Processos</Label>
            <input id="upload-pericias" type="file" accept=".xlsx" onChange={handleUploadPericias} disabled={processandoPericias} />
          </div>

          {temPreviewPericias && (
            <>
              <PericiasPreviewTable linhas={linhas} onChange={setLinhas} />
              <Button type="button" onClick={handleConfirmarPericias} disabled={!podeConfirmarPericias || processandoPericias}>
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
        </TabsContent>

        <TabsContent value="peritos" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="upload-peritos">Planilha de Peritos e Colaboradores</Label>
            <input id="upload-peritos" type="file" accept=".xlsx" onChange={handleUploadPeritos} disabled={processandoPeritos} />
          </div>

          {temPreviewPeritos && (
            <>
              <PeritosColaboradoresPreviewTable
                colaboradores={colaboradores}
                peritos={peritos}
                onChangeColaboradores={setColaboradores}
                onChangePeritos={setPeritos}
              />
              <Button type="button" onClick={handleConfirmarPeritos} disabled={!podeConfirmarPeritos || processandoPeritos}>
                Confirmar importação
              </Button>
            </>
          )}

          {naoProcessadasPeritos.length > 0 && (
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-muted-foreground">Linhas não processadas</h2>
              {naoProcessadasPeritos.map((n) => (
                <p key={n.linhaOriginal} className="text-sm">{n.motivo}</p>
              ))}
            </div>
          )}

          {relatorioPeritos && (
            <div className="rounded-md border p-4 text-sm">
              <p>
                {relatorioPeritos.peritosCriados} {pluralizar(relatorioPeritos.peritosCriados, 'perito criado', 'peritos criados')},{' '}
                {relatorioPeritos.peritosAtualizados} {pluralizar(relatorioPeritos.peritosAtualizados, 'atualizado', 'atualizados')}.
              </p>
              <p>
                {relatorioPeritos.colaboradoresCriados} {pluralizar(relatorioPeritos.colaboradoresCriados, 'colaborador criado', 'colaboradores criados')},{' '}
                {relatorioPeritos.colaboradoresAtualizados} {pluralizar(relatorioPeritos.colaboradoresAtualizados, 'atualizado', 'atualizados')}.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
