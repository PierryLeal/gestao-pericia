'use client';

import { use, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { formatPhone } from '@/lib/masks';
import type { Colaborador } from '../actions';

export function ColaboradoresTableAsync({
  itemsPromise,
  onEdit,
  onDelete,
}: {
  itemsPromise: Promise<Colaborador[]>;
  onEdit: (colaborador: Colaborador) => void;
  onDelete: (colaborador: Colaborador) => Promise<void>;
}) {
  const items = use(itemsPromise);
  return <ColaboradoresTable items={items} onEdit={onEdit} onDelete={onDelete} />;
}

export function ColaboradoresTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Colaborador[];
  onEdit: (colaborador: Colaborador) => void;
  onDelete: (colaborador: Colaborador) => Promise<void>;
}) {
  const [confirmTarget, setConfirmTarget] = useState<Colaborador | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum colaborador cadastrado.</p>;
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
            <TableHead>Nome</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Formação</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.nome}</TableCell>
              <TableCell>{formatPhone(item.contato)}</TableCell>
              <TableCell>{item.formacao}</TableCell>
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
        title="Excluir colaborador"
        description={`Excluir "${confirmTarget?.nome}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
