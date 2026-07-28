'use client';

import { Pencil } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { Colaborador } from '../actions';

export function ColaboradoresTable({ items, onEdit }: { items: Colaborador[]; onEdit: (colaborador: Colaborador) => void }) {
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
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.nome}</TableCell>
            <TableCell>{item.contato}</TableCell>
            <TableCell>{item.formacao}</TableCell>
            <TableCell>{item.interno ? 'Interno' : 'Externo'}</TableCell>
            <TableCell>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                <Pencil className="size-4" />
                <span className="sr-only">Editar {item.nome}</span>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
