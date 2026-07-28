'use client';

import { Pencil } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { Processo } from '../actions';

export function ProcessosTable({ items, onEdit }: { items: Processo[]; onEdit: (processo: Processo) => void }) {
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum processo cadastrado.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Autor</TableHead>
          <TableHead>Réu</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.numero}</TableCell>
            <TableCell>{item.autor}</TableCell>
            <TableCell>{item.reu}</TableCell>
            <TableCell>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                <Pencil className="size-4" />
                <span className="sr-only">Editar {item.numero}</span>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
