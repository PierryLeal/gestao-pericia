'use client';

import { Fragment, use, useState } from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { cn } from '@/lib/utils';
import type { PericiaListItem } from '../actions';

export function PericiasTableAsync({
  itemsPromise,
  onEdit,
}: {
  itemsPromise: Promise<PericiaListItem[]>;
  onEdit: (item: PericiaListItem) => void;
}) {
  const items = use(itemsPromise);
  return <PericiasTable items={items} onEdit={onEdit} />;
}

export function PericiasTable({ items, onEdit }: { items: PericiaListItem[]; onEdit: (item: PericiaListItem) => void }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma perícia encontrada.</p>;
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Nº Processo</TableHead>
          <TableHead>Data - Hora</TableHead>
          <TableHead>Local</TableHead>
          <TableHead>Perito</TableHead>
          <TableHead>Colaborador</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead className="w-12" />
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
                  {new Date(`${item.dataAgendada}T${item.horaAgendada}`).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
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
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                    <Pencil className="size-4" />
                    <span className="sr-only">Editar perícia {item.processo.numero}</span>
                  </Button>
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell colSpan={8} className="whitespace-normal bg-muted/30">
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
                          Contato: {item.perito.contato} · Formação: {item.perito.formacao} · CREA: {item.perito.crea}
                          <br />
                          Já trabalhamos: {item.perito.jaTrabalhamos ? 'Sim' : 'Não'} · Relação: {item.perito.relacao}/10 · Resultados: {item.perito.resultados}/10
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Colaborador</p>
                        {item.colaborador ? (
                          <p className="text-sm">
                            Contato: {item.colaborador.contato} · Formação: {item.colaborador.formacao} ·{' '}
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
  );
}
