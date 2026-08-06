'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  previewImportacaoPericias, confirmarImportacaoPericias,
  previewImportacaoPeritosColaboradores, confirmarImportacaoPeritosColaboradores,
} from '../actions';
import type {
  PericiaPreviewRow, NaoProcessada, RelatorioImportacaoPericias,
  ColaboradorPreviewRow, PeritoPreviewRow, RelatorioImportacaoPeritosColaboradores,
  LinhaComErro,
} from '../types';
import { PericiasPreviewTable } from './pericias-preview-table';
import { PeritosColaboradoresPreviewTable } from './peritos-colaboradores-preview-table';
import { dividirEmLotes, mesclarRelatorios } from '../lib/lotes';

// The server processes rows within one batch concurrently, but each call still
// re-reads the full cadastro up front — chunking keeps that cost bounded and
// gives the UI a progress readout on a large sheet instead of one long spinner.
const TAMANHO_LOTE_CONFIRMACAO = 250;

function pluralizar(quantidade: number, singular: string, plural: string): string {
  return quantidade === 1 ? singular : plural;
}

function UploadBox({
  id,
  titulo,
  descricao,
  fileName,
  processing,
  onChange,
}: {
  id: string;
  titulo: string;
  descricao: string;
  fileName: string | null;
  processing: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>
          {fileName ? `Arquivo selecionado: ${fileName}` : descricao}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label
          htmlFor={id}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-8 text-center transition-colors hover:border-ring hover:bg-accent/50',
            processing && 'pointer-events-none opacity-60'
          )}
        >
          <span className="sr-only">{titulo}</span>
          {processing ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <FileSpreadsheet className="size-6 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {processing ? 'Processando planilha...' : 'Clique para selecionar uma planilha'}
          </span>
          <span className="text-xs text-muted-foreground">Formato aceito: .xlsx</span>
        </label>
        <input id={id} type="file" accept=".xlsx" className="sr-only" onChange={onChange} disabled={processing} />
      </CardContent>
    </Card>
  );
}

function LegendaPreview({
  mostrarDuplicada,
  mostrarSuspeito,
}: {
  mostrarDuplicada?: boolean;
  mostrarSuspeito?: boolean;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
      <p className="flex items-center gap-1.5">
        <span className="size-2.5 shrink-0 rounded-full bg-destructive/60" />
        <span>
          <strong className="font-medium text-foreground">Linha rosa:</strong> precisa de revisão antes
          de confirmar. A última coluna, <strong className="font-medium text-foreground">Motivo</strong>,
          explica o que verificar nessa linha (por exemplo, situação não reconhecida ou cidade não
          encontrada).
        </span>
      </p>
      {mostrarSuspeito && (
        <p className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full bg-amber-500/70" />
          <span>
            <strong className="font-medium text-foreground">Linha amarela:</strong> o nome do colaborador
            tem só uma letra — provavelmente um erro de leitura da planilha, não uma pessoa real. Corrija
            o nome antes de confirmar; enquanto estiver assim, essa linha não será importada.
          </span>
        </p>
      )}
      {mostrarDuplicada && (
        <p className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/50" />
          <span>
            <strong className="font-medium text-foreground">Linha esmaecida:</strong> já existe uma
            perícia igual cadastrada — essa linha será ignorada, não será duplicada.
          </span>
        </p>
      )}
    </div>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function NaoProcessadas({ linhas }: { linhas: NaoProcessada[] }) {
  if (linhas.length === 0) return null;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <AlertTriangle className="size-4" />
        Linhas não processadas
      </p>
      {linhas.map((n, index) => (
        <p key={`${n.linhaOriginal}-${index}`} className="text-sm">
          {n.linhaOriginal > 0 && (
            <>
              Linha {n.linhaOriginal}
              {n.texto && (
                <>
                  : &quot;<span>{n.texto}</span>&quot;
                </>
              )}
              {' — '}
            </>
          )}
          <span>{n.motivo}</span>
        </p>
      ))}
    </div>
  );
}

function LinhasComErro({ linhas }: { linhas: LinhaComErro[] }) {
  if (linhas.length === 0) return null;
  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="flex items-center gap-1.5 font-medium text-destructive">
        <AlertTriangle className="size-4" />
        {linhas.length} {pluralizar(linhas.length, 'linha com erro', 'linhas com erro')}:
      </p>
      {linhas.map((linha, index) => (
        <p key={`${linha.linhaOriginal}-${index}`} className="text-xs text-muted-foreground">
          Linha {linha.linhaOriginal}: {linha.erro}
        </p>
      ))}
    </div>
  );
}

export function ImportarPlanilhaScreen() {
  const [linhas, setLinhas] = useState<PericiaPreviewRow[]>([]);
  const [naoProcessadas, setNaoProcessadas] = useState<NaoProcessada[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioImportacaoPericias | null>(null);
  const [processandoPericias, setProcessandoPericias] = useState(false);
  const [temPreviewPericias, setTemPreviewPericias] = useState(false);
  const [fileNamePericias, setFileNamePericias] = useState<string | null>(null);
  const [progressoPericias, setProgressoPericias] = useState<{ processadas: number; total: number } | null>(null);

  const [colaboradores, setColaboradores] = useState<ColaboradorPreviewRow[]>([]);
  const [peritos, setPeritos] = useState<PeritoPreviewRow[]>([]);
  const [naoProcessadasPeritos, setNaoProcessadasPeritos] = useState<NaoProcessada[]>([]);
  const [relatorioPeritos, setRelatorioPeritos] = useState<RelatorioImportacaoPeritosColaboradores | null>(null);
  const [processandoPeritos, setProcessandoPeritos] = useState(false);
  const [temPreviewPeritos, setTemPreviewPeritos] = useState(false);
  const [fileNamePeritos, setFileNamePeritos] = useState<string | null>(null);
  const [progressoPeritos, setProgressoPeritos] = useState<{ processadas: number; total: number } | null>(null);

  async function handleUploadPericias(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRelatorio(null);
    setProcessandoPericias(true);
    setFileNamePericias(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const resultado = await previewImportacaoPericias(buffer);
      setLinhas(resultado.linhas);
      setNaoProcessadas(resultado.naoProcessadas);
      setTemPreviewPericias(true);
    } catch {
      toast.error('Não foi possível ler essa planilha.');
    } finally {
      setProcessandoPericias(false);
      e.target.value = '';
    }
  }

  async function handleConfirmarPericias() {
    setProcessandoPericias(true);
    const lotes = dividirEmLotes(linhas, TAMANHO_LOTE_CONFIRMACAO);
    setProgressoPericias({ processadas: 0, total: linhas.length });
    let acumulado: RelatorioImportacaoPericias = {
      processosCriados: 0, processosAtualizados: 0, periciasCriadas: 0,
      peritosCriados: 0, colaboradoresCriados: 0, puladasPorDuplicidade: 0, linhasComErro: [],
    };
    let processadas = 0;
    try {
      for (const lote of lotes) {
        const resultado = await confirmarImportacaoPericias(lote);
        acumulado = mesclarRelatorios(acumulado, resultado);
        processadas += lote.length;
        setProgressoPericias({ processadas, total: linhas.length });
      }
      setRelatorio(acumulado);
      setLinhas([]);
      setTemPreviewPericias(false);
    } catch {
      // Rows already processed in earlier batches are already saved; only the
      // remaining, not-yet-attempted rows are left in the preview for a retry.
      setRelatorio(acumulado);
      setLinhas((atual) => atual.slice(processadas));
      toast.error('Não foi possível concluir a importação. As linhas já processadas foram salvas — tente novamente para as restantes.');
    } finally {
      setProcessandoPericias(false);
      setProgressoPericias(null);
    }
  }

  async function handleUploadPeritos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRelatorioPeritos(null);
    setProcessandoPeritos(true);
    setFileNamePeritos(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const resultado = await previewImportacaoPeritosColaboradores(buffer);
      setColaboradores(resultado.colaboradores);
      setPeritos(resultado.peritos);
      setNaoProcessadasPeritos(resultado.naoProcessadas);
      setTemPreviewPeritos(true);
    } catch {
      toast.error('Não foi possível ler essa planilha.');
    } finally {
      setProcessandoPeritos(false);
      e.target.value = '';
    }
  }

  async function handleConfirmarPeritos() {
    setProcessandoPeritos(true);
    const lotesColaboradores = dividirEmLotes(colaboradores, TAMANHO_LOTE_CONFIRMACAO);
    const lotesPeritos = dividirEmLotes(peritos, TAMANHO_LOTE_CONFIRMACAO);
    const totalPassos = Math.max(lotesColaboradores.length, lotesPeritos.length);
    const total = colaboradores.length + peritos.length;
    setProgressoPeritos({ processadas: 0, total });
    let acumulado: RelatorioImportacaoPeritosColaboradores = {
      peritosCriados: 0, peritosAtualizados: 0, colaboradoresCriados: 0, colaboradoresAtualizados: 0, linhasComErro: [],
    };
    let processadas = 0;
    let passosConcluidos = 0;
    try {
      for (let i = 0; i < totalPassos; i++) {
        const loteColaboradores = lotesColaboradores[i] ?? [];
        const lotePeritos = lotesPeritos[i] ?? [];
        const resultado = await confirmarImportacaoPeritosColaboradores(loteColaboradores, lotePeritos);
        acumulado = mesclarRelatorios(acumulado, resultado);
        processadas += loteColaboradores.length + lotePeritos.length;
        passosConcluidos++;
        setProgressoPeritos({ processadas, total });
      }
      setRelatorioPeritos(acumulado);
      setColaboradores([]);
      setPeritos([]);
      setTemPreviewPeritos(false);
    } catch {
      setRelatorioPeritos(acumulado);
      setColaboradores((atual) => atual.slice(lotesColaboradores.slice(0, passosConcluidos).reduce((n, l) => n + l.length, 0)));
      setPeritos((atual) => atual.slice(lotesPeritos.slice(0, passosConcluidos).reduce((n, l) => n + l.length, 0)));
      toast.error('Não foi possível concluir a importação. As linhas já processadas foram salvas — tente novamente para as restantes.');
    } finally {
      setProcessandoPeritos(false);
      setProgressoPeritos(null);
    }
  }

  const podeConfirmarPericias = linhas.some((l) => l.status === 'ok' || l.status === 'atencao' || l.status === 'suspeito');
  const podeConfirmarPeritos = colaboradores.length > 0 || peritos.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Importar planilha</h1>
        <p className="text-sm text-muted-foreground">
          Envie uma planilha para importar processos, perícias, peritos e colaboradores em lote.
        </p>
      </div>

      <Tabs defaultValue="pericias">
        <TabsList>
          <TabsTrigger value="pericias">Perícias e Processos</TabsTrigger>
          <TabsTrigger value="peritos">Peritos e Colaboradores</TabsTrigger>
        </TabsList>

        <TabsContent value="pericias" className="space-y-4">
          <UploadBox
            id="upload-pericias"
            titulo="Planilha de Perícias e Processos"
            descricao="Colunas de processo, agendamento, local, perito e colaborador."
            fileName={fileNamePericias}
            processing={processandoPericias}
            onChange={handleUploadPericias}
          />

          {temPreviewPericias && (
            <Card>
              <CardHeader>
                <CardTitle>Pré-visualização</CardTitle>
                <CardDescription>
                  {linhas.length} {pluralizar(linhas.length, 'linha encontrada', 'linhas encontradas')}. Revise e edite antes de confirmar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <LegendaPreview mostrarDuplicada mostrarSuspeito />
                <PericiasPreviewTable linhas={linhas} onChange={setLinhas} />
              </CardContent>
              <CardFooter>
                <Button type="button" onClick={handleConfirmarPericias} disabled={!podeConfirmarPericias || processandoPericias}>
                  {processandoPericias && <Loader2 className="size-4 animate-spin" />}
                  {processandoPericias
                    ? progressoPericias
                      ? `Confirmando... ${progressoPericias.processadas} de ${progressoPericias.total}`
                      : 'Confirmando...'
                    : 'Confirmar importação'}
                </Button>
              </CardFooter>
            </Card>
          )}

          <NaoProcessadas linhas={naoProcessadas} />

          {relatorio && (
            <Card>
              <CardHeader>
                <CardTitle>Resultado da importação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatTile
                    value={relatorio.processosCriados}
                    label={pluralizar(relatorio.processosCriados, 'processo criado', 'processos criados')}
                  />
                  <StatTile
                    value={relatorio.processosAtualizados}
                    label={pluralizar(relatorio.processosAtualizados, 'processo atualizado', 'processos atualizados')}
                  />
                  <StatTile
                    value={relatorio.periciasCriadas}
                    label={pluralizar(relatorio.periciasCriadas, 'perícia criada', 'perícias criadas')}
                  />
                  <StatTile
                    value={relatorio.peritosCriados}
                    label={pluralizar(relatorio.peritosCriados, 'perito criado', 'peritos criados')}
                  />
                  <StatTile
                    value={relatorio.colaboradoresCriados}
                    label={pluralizar(relatorio.colaboradoresCriados, 'colaborador criado', 'colaboradores criados')}
                  />
                  <StatTile
                    value={relatorio.puladasPorDuplicidade}
                    label={pluralizar(relatorio.puladasPorDuplicidade, 'linha pulada', 'linhas puladas')}
                  />
                </div>
                <LinhasComErro linhas={relatorio.linhasComErro} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="peritos" className="space-y-4">
          <UploadBox
            id="upload-peritos"
            titulo="Planilha de Peritos e Colaboradores"
            descricao="Planilha com as seções de colaboradores e peritos."
            fileName={fileNamePeritos}
            processing={processandoPeritos}
            onChange={handleUploadPeritos}
          />

          {temPreviewPeritos && (
            <Card>
              <CardHeader>
                <CardTitle>Pré-visualização</CardTitle>
                <CardDescription>Revise e edite antes de confirmar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <LegendaPreview />
                <PeritosColaboradoresPreviewTable
                  colaboradores={colaboradores}
                  peritos={peritos}
                  onChangeColaboradores={setColaboradores}
                  onChangePeritos={setPeritos}
                />
              </CardContent>
              <CardFooter>
                <Button type="button" onClick={handleConfirmarPeritos} disabled={!podeConfirmarPeritos || processandoPeritos}>
                  {processandoPeritos && <Loader2 className="size-4 animate-spin" />}
                  {processandoPeritos
                    ? progressoPeritos
                      ? `Confirmando... ${progressoPeritos.processadas} de ${progressoPeritos.total}`
                      : 'Confirmando...'
                    : 'Confirmar importação'}
                </Button>
              </CardFooter>
            </Card>
          )}

          <NaoProcessadas linhas={naoProcessadasPeritos} />

          {relatorioPeritos && (
            <Card>
              <CardHeader>
                <CardTitle>Resultado da importação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile
                    value={relatorioPeritos.peritosCriados}
                    label={pluralizar(relatorioPeritos.peritosCriados, 'perito criado', 'peritos criados')}
                  />
                  <StatTile
                    value={relatorioPeritos.peritosAtualizados}
                    label={pluralizar(relatorioPeritos.peritosAtualizados, 'perito atualizado', 'peritos atualizados')}
                  />
                  <StatTile
                    value={relatorioPeritos.colaboradoresCriados}
                    label={pluralizar(relatorioPeritos.colaboradoresCriados, 'colaborador criado', 'colaboradores criados')}
                  />
                  <StatTile
                    value={relatorioPeritos.colaboradoresAtualizados}
                    label={pluralizar(relatorioPeritos.colaboradoresAtualizados, 'colaborador atualizado', 'colaboradores atualizados')}
                  />
                </div>
                <LinhasComErro linhas={relatorioPeritos.linhasComErro} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
