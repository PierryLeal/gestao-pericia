'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TableSkeleton } from '@/components/shared/table-skeleton';
import { ColaboradoresTableAsync } from './colaboradores-table';
import { ColaboradorForm } from './colaborador-form';
import { ColaboradoresFilters } from './colaboradores-filters';
import { deleteColaborador, type Colaborador } from '../actions';

const COLABORADORES_HEADERS = ['Nome', 'Contato', 'Formação', ''];

export function ColaboradoresScreen({ itemsPromise }: { itemsPromise: Promise<Colaborador[]> }) {
  const router = useRouter();
  const [isFiltering, startFilterTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(colaborador: Colaborador) {
    setEditing(colaborador);
    setDialogOpen(true);
  }

  function handleSaved() {
    toast.success(editing ? 'Colaborador atualizado' : 'Colaborador criado');
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete(colaborador: Colaborador) {
    const result = await deleteColaborador(colaborador.id);
    if (result.success) {
      toast.success('Colaborador excluído');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          Novo colaborador
        </Button>
      </div>
      <ColaboradoresFilters startTransition={startFilterTransition} />
      {isFiltering ? (
        <TableSkeleton headers={COLABORADORES_HEADERS} />
      ) : (
        <Suspense fallback={<TableSkeleton headers={COLABORADORES_HEADERS} />}>
          <ColaboradoresTableAsync itemsPromise={itemsPromise} onEdit={openEdit} onDelete={handleDelete} />
        </Suspense>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar colaborador' : 'Novo colaborador'}</DialogTitle>
          </DialogHeader>
          <ColaboradorForm
            colaborador={editing ?? undefined}
            onSaved={handleSaved}
            onError={(message) => toast.error(message)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
