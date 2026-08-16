'use client';

import { Fragment, use, useState } from 'react';
import { AlertTriangle, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/shared/status-badge';
import { RelacaoBadge } from '@/components/shared/relacao-badge';
import { ResultadoBadge } from '@/components/shared/resultado-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { TooltipCell } from '@/components/shared/tooltip-cell';
import { PaginationControls } from '@/components/shared/pagination-controls';
import { SortableTableHead } from '@/components/shared/sortable-table-head';
import { paginar, totalDePaginas, ITENS_POR_PAGINA_PADRAO } from '@/lib/paginar';
import { alternarCriterio, ordenar, type CriterioOrdenacao, type DirecaoOrdenacao } from '@/lib/ordenar';
import { cn } from '@/lib/utils';
import { formatPhone } from '@/lib/masks';
import { formatarNumeroProcesso, isNumeroProvisorio, rotuloNumeroProcesso } from '@/lib/processo-numero-provisorio';
import type { PericiaListItem } from '../actions';

type ColunaOrdenavel =
  | 'numero' | 'escritorio' | 'contrato' | 'dataHora' | 'local' | 'perito' | 'colaborador' | 'situacao' | 'observacoes';

function valorParaOrdenar(item: PericiaListItem, coluna: ColunaOrdenavel): string | number | null {
  switch (coluna) {
    case 'numero':
      return formatarNumeroProcesso(item.processo?.numero) || null;
    case 'escritorio':
      return item.processo?.escritorio || null;
    case 'contrato':
      return item.contrato;
    case 'dataHora':
      return item.dataAgendada ? `${item.dataAgendada}T${item.horaAgendada ?? '00:00'}` : null;
    case 'local':
      return item.municipio ? `${item.municipio.nome}/${item.municipio.uf}` : null;
    case 'perito':
      return item.perito?.nome ?? null;
    case 'colaborador':
      return item.colaboradores.length > 0 ? item.colaboradores.map((c) => c.nome).join(', ') : null;
    case 'situacao':
      return item.situacao;
    case 'observacoes':
      return item.observacoes;
  }
}

export function PericiasTableAsync({
  itemsPromise,
  onEdit,
  onDelete,
}: {
  itemsPromise: Promise<PericiaListItem[]>;
  onEdit: (item: PericiaListItem) => void;
  onDelete: (item: PericiaListItem) => Promise<void>;
}) {
  const items = use(itemsPromise);
  return <PericiasTable items={items} onEdit={onEdit} onDelete={onDelete} />;
}

export function PericiasTable({
  items,
  onEdit,
  onDelete,
}: {
  items: PericiaListItem[];
  onEdit: (item: PericiaListItem) => void;
  onDelete: (item: PericiaListItem) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<PericiaListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [criterios, setCriterios] = useState<CriterioOrdenacao<ColunaOrdenavel>[]>([]);

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma perícia encontrada.</p>;
  }

  function ordenarPor(coluna: ColunaOrdenavel, direcao: DirecaoOrdenacao) {
    setCriterios((atual) => alternarCriterio(atual, coluna, direcao));
    setPagina(1);
  }
  const direcaoDe = (coluna: ColunaOrdenavel) => criterios.find((c) => c.coluna === coluna)?.direcao ?? null;

  const itensOrdenados = ordenar(items, criterios, valorParaOrdenar);
  const totalPaginas = totalDePaginas(itensOrdenados.length, ITENS_POR_PAGINA_PADRAO);
  const paginaEfetiva = Math.min(pagina, totalPaginas);
  const itensDaPagina = paginar(itensOrdenados, paginaEfetiva, ITENS_POR_PAGINA_PADRAO);

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await onDelete(confirmTarget);
    } finally {
      setDeleting(false);
      setConfirmTarget(null);
    }
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <SortableTableHead label="Nº Processo" direcao={direcaoDe('numero')} onOrdenar={(d) => ordenarPor('numero', d)} />
            <SortableTableHead label="Escritório" direcao={direcaoDe('escritorio')} onOrdenar={(d) => ordenarPor('escritorio', d)} />
            <SortableTableHead label="Contrato" direcao={direcaoDe('contrato')} onOrdenar={(d) => ordenarPor('contrato', d)} />
            <SortableTableHead label="Data - Hora" direcao={direcaoDe('dataHora')} onOrdenar={(d) => ordenarPor('dataHora', d)} />
            <SortableTableHead label="Local" direcao={direcaoDe('local')} onOrdenar={(d) => ordenarPor('local', d)} />
            <SortableTableHead label="Perito" direcao={direcaoDe('perito')} onOrdenar={(d) => ordenarPor('perito', d)} />
            <SortableTableHead label="Colaborador" direcao={direcaoDe('colaborador')} onOrdenar={(d) => ordenarPor('colaborador', d)} />
            <SortableTableHead label="Situação" direcao={direcaoDe('situacao')} onOrdenar={(d) => ordenarPor('situacao', d)} />
            <SortableTableHead label="Obs." direcao={direcaoDe('observacoes')} onOrdenar={(d) => ordenarPor('observacoes', d)} />
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {itensDaPagina.map((item) => {
            const isExpanded = expanded.has(item.id);
            const numeroLabel = rotuloNumeroProcesso(item.processo?.numero, 'Sem processo');
            const numeroNaoIdentificado = !item.processo || isNumeroProvisorio(item.processo.numero);
            const temProblema = item.problemas.length > 0;
            return (
              <Fragment key={item.id}>
                <TableRow className={cn(temProblema && 'bg-destructive/10')}>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggle(item.id)}>
                      <ChevronRight className={cn('size-4 transition-transform', isExpanded && 'rotate-90')} />
                      <span className="sr-only">Detalhes da perícia {numeroLabel}</span>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {temProblema && (
                        <Tooltip>
                          <TooltipTrigger render={<span className="inline-flex" />}>
                            <AlertTriangle className="size-4 shrink-0 text-destructive" />
                            <span className="sr-only">Perícia com pendências</span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <ul className="list-disc pl-3">
                              {item.problemas.map((problema) => (
                                <li key={problema}>{problema}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <span className={cn(numeroNaoIdentificado && 'text-muted-foreground')}>{numeroLabel}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TooltipCell
                      label={<span className="block max-w-32 truncate">{item.processo?.escritorio ?? '—'}</span>}
                      detail={item.processo?.escritorio ?? ''}
                    />
                  </TableCell>
                  <TableCell>
                    {item.contrato ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {item.dataAgendada && item.horaAgendada ? (
                      new Date(`${item.dataAgendada}T${item.horaAgendada}`).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    ) : item.dataAgendada ? (
                      <>
                        {new Date(`${item.dataAgendada}T00:00`).toLocaleDateString('pt-BR')}
                        {' · '}
                        <span className="text-muted-foreground">Hora não definida</span>
                      </>
                    ) : item.horaAgendada ? (
                      <>
                        <span className="text-muted-foreground">Data não definida</span>
                        {' · '}
                        {item.horaAgendada}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Não agendado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.municipio ? (
                      `${item.municipio.nome}/${item.municipio.uf}`
                    ) : (
                      <span className="text-muted-foreground">Sem município</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.perito ? item.perito.nome : <span className="text-muted-foreground">Sem perito</span>}
                  </TableCell>
                  <TableCell>
                    {item.colaboradores.length > 0
                      ? item.colaboradores.map((c) => c.nome).join(', ')
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge situacao={item.situacao} />
                  </TableCell>
                  <TableCell>
                    {item.observacoes ? (
                      <TooltipCell
                        label={<span className="block max-w-40 truncate">{item.observacoes}</span>}
                        detail={item.observacoes}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                      <Pencil className="size-4" />
                      <span className="sr-only">Editar perícia {numeroLabel}</span>
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmTarget(item)}>
                      <Trash2 className="size-4" />
                      <span className="sr-only">Excluir perícia {numeroLabel}</span>
                    </Button>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={11} className="whitespace-normal bg-muted/30">
                      <div className="grid gap-4 py-2 md:grid-cols-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Processo</p>
                          {item.processo ? (
                            <p className="text-sm">
                              Autor: {item.processo.autor}
                              <br />
                              Réu: {item.processo.reu}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum processo vinculado.</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Perito</p>
                          {item.perito ? (
                            <>
                              <p className="text-sm">
                                Contato: {formatPhone(item.perito.contato)}
                                <br />
                                Formação: {item.perito.formacao}
                                <br />
                                CREA: {item.perito.crea}
                                <br />
                                Já trabalhamos: {item.perito.jaTrabalhamos ? 'Sim' : 'Não'}
                              </p>
                              <div className="mt-1 flex gap-1.5">
                                <RelacaoBadge relacao={item.perito.relacao} />
                                <ResultadoBadge resultado={item.perito.resultados} />
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum perito vinculado.</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            {item.colaboradores.length > 1 ? 'Colaboradores' : 'Colaborador'}
                          </p>
                          {item.colaboradores.length > 0 ? (
                            <div className="space-y-1.5">
                              {item.colaboradores.map((c) => (
                                <p key={c.id} className="text-sm">
                                  {item.colaboradores.length > 1 && <span className="font-medium">{c.nome}</span>}
                                  {item.colaboradores.length > 1 && <br />}
                                  Contato: {formatPhone(c.contato)}
                                  <br />
                                  Formação: {c.formacao}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado.</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <PaginationControls
        paginaAtual={paginaEfetiva}
        totalPaginas={totalPaginas}
        total={items.length}
        rotulo={items.length === 1 ? 'perícia' : 'perícias'}
        onPageChange={setPagina}
      />
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Excluir perícia"
        description={`Excluir a perícia do processo "${rotuloNumeroProcesso(confirmTarget?.processo?.numero, 'sem processo')}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
