'use client';

import { Fragment, use, useState } from 'react';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { RelacaoBadge } from '@/components/shared/relacao-badge';
import { ResultadoBadge } from '@/components/shared/resultado-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { TooltipCell } from '@/components/shared/tooltip-cell';
import { cn } from '@/lib/utils';
import { formatPhone } from '@/lib/masks';
import type { PericiaListItem } from '../actions';

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

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma perícia encontrada.</p>;
  }

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
            <TableHead>Nº Processo</TableHead>
            <TableHead>Escritório</TableHead>
            <TableHead>Data - Hora</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Perito</TableHead>
            <TableHead>Colaborador</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Obs.</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isExpanded = expanded.has(item.id);
            return (
              <Fragment key={item.id}>
                <TableRow>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggle(item.id)}>
                      <ChevronRight className={cn('size-4 transition-transform', isExpanded && 'rotate-90')} />
                      <span className="sr-only">Detalhes da perícia {item.processo.numero}</span>
                    </Button>
                  </TableCell>
                  <TableCell>{item.processo.numero}</TableCell>
                  <TableCell>
                    <TooltipCell
                      label={<span className="block max-w-32 truncate">{item.processo.escritorio}</span>}
                      detail={item.processo.escritorio}
                    />
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
                  <TableCell>{item.municipio.nome}/{item.municipio.uf}</TableCell>
                  <TableCell>{item.perito.nome}</TableCell>
                  <TableCell>
                    {item.colaborador ? item.colaborador.nome : <span className="text-muted-foreground">—</span>}
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
                      <span className="sr-only">Editar perícia {item.processo.numero}</span>
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmTarget(item)}>
                      <Trash2 className="size-4" />
                      <span className="sr-only">Excluir perícia {item.processo.numero}</span>
                    </Button>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={10} className="whitespace-normal bg-muted/30">
                      <div className="grid gap-4 py-2 md:grid-cols-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Processo</p>
                          <p className="text-sm">
                            Autor: {item.processo.autor}
                            <br />
                            Réu: {item.processo.reu}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Perito</p>
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
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Colaborador</p>
                          {item.colaborador ? (
                            <p className="text-sm">
                              Contato: {formatPhone(item.colaborador.contato)} · Formação: {item.colaborador.formacao} ·{' '}
                              {item.colaborador.interno ? 'Interno' : 'Externo'}
                            </p>
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
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Excluir perícia"
        description={`Excluir a perícia do processo "${confirmTarget?.processo.numero}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
