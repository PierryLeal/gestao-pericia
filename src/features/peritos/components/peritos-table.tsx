'use client';

import { use } from 'react';
import { Pencil } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RelacaoBadge } from '@/components/shared/relacao-badge';
import { ResultadoBadge } from '@/components/shared/resultado-badge';
import { formatPhone } from '@/lib/masks';
import type { Perito } from '../actions';

export function PeritosTableAsync({
  itemsPromise,
  onEdit,
}: {
  itemsPromise: Promise<Perito[]>;
  onEdit: (perito: Perito) => void;
}) {
  const items = use(itemsPromise);
  return <PeritosTable items={items} onEdit={onEdit} />;
}

export function PeritosTable({ items, onEdit }: { items: Perito[]; onEdit: (perito: Perito) => void }) {
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
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.nome}</TableCell>
            <TableCell>{formatPhone(item.contato)}</TableCell>
            <TableCell>{item.formacao}</TableCell>
            <TableCell>{item.crea}</TableCell>
            <TableCell><RelacaoBadge relacao={item.relacao} /></TableCell>
            <TableCell><ResultadoBadge resultado={item.resultados} /></TableCell>
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
