'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TooltipCell } from '@/components/shared/tooltip-cell';
import { StatusBadge } from '@/components/shared/status-badge';
import type { PericiaListItem } from '../actions';

export function PericiasTable({ items }: { items: PericiaListItem[] }) {
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma perícia encontrada.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nº Processo</TableHead>
          <TableHead>Data - Hora</TableHead>
          <TableHead>Local</TableHead>
          <TableHead>Perito</TableHead>
          <TableHead>Colaborador</TableHead>
          <TableHead>Situação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/pericias/${item.id}`}>
                <TooltipCell label={item.processo.numero} detail={`${item.processo.autor} × ${item.processo.reu}`} />
              </Link>
            </TableCell>
            <TableCell>
              {new Date(`${item.dataAgendada}T${item.horaAgendada}`).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </TableCell>
            <TableCell>
              <TooltipCell
                label={`${item.municipio.nome}/${item.municipio.uf}`}
                detail={`${item.municipio.nome} - ${item.municipio.uf}`}
              />
            </TableCell>
            <TableCell>
              <TooltipCell
                label={item.perito.nome}
                detail={
                  `Contato: ${item.perito.contato} | Formação: ${item.perito.formacao} | ` +
                  `CREA: ${item.perito.crea} | Já trabalhamos: ${item.perito.jaTrabalhamos ? 'Sim' : 'Não'} | ` +
                  `Relação: ${item.perito.relacao}/10 | Resultados: ${item.perito.resultados}/10`
                }
              />
            </TableCell>
            <TableCell>
              {item.colaborador ? (
                <TooltipCell
                  label={item.colaborador.nome}
                  detail={
                    `Contato: ${item.colaborador.contato} | Formação: ${item.colaborador.formacao} | ` +
                    `${item.colaborador.interno ? 'Interno' : 'Externo'}`
                  }
                />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge situacao={item.situacao} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
