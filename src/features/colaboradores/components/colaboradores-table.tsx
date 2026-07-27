'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Colaborador } from '../actions';

export function ColaboradoresTable({ items }: { items: Colaborador[] }) {
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum colaborador cadastrado.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Contato</TableHead>
          <TableHead>Formação</TableHead>
          <TableHead>Tipo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/colaboradores/${item.id}`} className="hover:underline">{item.nome}</Link>
            </TableCell>
            <TableCell>{item.contato}</TableCell>
            <TableCell>{item.formacao}</TableCell>
            <TableCell>{item.interno ? 'Interno' : 'Externo'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
