'use client';

import { use, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RelacaoBadge } from '@/components/shared/relacao-badge';
import { ResultadoBadge } from '@/components/shared/resultado-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { formatPhone } from '@/lib/masks';
import type { Perito } from '../actions';

export function PeritosTableAsync({
  itemsPromise,
  onEdit,
  onDelete,
}: {
  itemsPromise: Promise<Perito[]>;
  onEdit: (perito: Perito) => void;
  onDelete: (perito: Perito) => Promise<void>;
}) {
  const items = use(itemsPromise);
  return <PeritosTable items={items} onEdit={onEdit} onDelete={onDelete} />;
}

export function PeritosTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Perito[];
  onEdit: (perito: Perito) => void;
  onDelete: (perito: Perito) => Promise<void>;
}) {
  const [confirmTarget, setConfirmTarget] = useState<Perito | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum perito cadastrado.</p>;
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    await onDelete(confirmTarget);
    setDeleting(false);
    setConfirmTarget(null);
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Formação</TableHead>
            <TableHead>CREA</TableHead>
            <TableHead>Relação</TableHead>
            <TableHead>Resultados</TableHead>
            <TableHead className="w-20" />
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
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmTarget(item)}>
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir {item.nome}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Excluir perito"
        description={`Excluir "${confirmTarget?.nome}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
