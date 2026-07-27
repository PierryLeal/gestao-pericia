'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Perito } from '../actions';

export function PeritosTable({ items }: { items: Perito[] }) {
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum perito cadastrado.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Contato</TableHead>
          <TableHead>Formação</TableHead>
          <TableHead>CREA</TableHead>
          <TableHead>Relação</TableHead>
          <TableHead>Resultados</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/peritos/${item.id}`} className="hover:underline">{item.nome}</Link>
            </TableCell>
            <TableCell>{item.contato}</TableCell>
            <TableCell>{item.formacao}</TableCell>
            <TableCell>{item.crea}</TableCell>
            <TableCell>{item.relacao}/10</TableCell>
            <TableCell>{item.resultados}/10</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
