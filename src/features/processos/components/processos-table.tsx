'use client';

import { use, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import type { Processo } from '../actions';

export function ProcessosTableAsync({
  itemsPromise,
  onEdit,
  onDelete,
}: {
  itemsPromise: Promise<Processo[]>;
  onEdit: (processo: Processo) => void;
  onDelete: (processo: Processo) => Promise<void>;
}) {
  const items = use(itemsPromise);
  return <ProcessosTable items={items} onEdit={onEdit} onDelete={onDelete} />;
}

export function ProcessosTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Processo[];
  onEdit: (processo: Processo) => void;
  onDelete: (processo: Processo) => Promise<void>;
}) {
  const [confirmTarget, setConfirmTarget] = useState<Processo | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum processo cadastrado.</p>;
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

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Autor</TableHead>
            <TableHead>Réu</TableHead>
            <TableHead className="w-20" />
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
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmTarget(item)}>
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir {item.numero}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Excluir processo"
        description={`Excluir o processo "${confirmTarget?.numero}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
