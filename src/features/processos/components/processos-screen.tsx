'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TableSkeleton } from '@/components/shared/table-skeleton';
import { ProcessosTableAsync } from './processos-table';
import { ProcessoForm } from './processo-form';
import { ProcessosFilters } from './processos-filters';
import type { Processo } from '../actions';

const PROCESSOS_HEADERS = ['Número', 'Autor', 'Réu', ''];

export function ProcessosScreen({ itemsPromise }: { itemsPromise: Promise<Processo[]> }) {
  const router = useRouter();
  const [isFiltering, startFilterTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Processo | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(processo: Processo) {
    setEditing(processo);
    setDialogOpen(true);
  }

  function handleSaved() {
    toast.success(editing ? 'Processo atualizado' : 'Processo criado');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Processos</h1>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          Novo processo
        </Button>
      </div>
      <ProcessosFilters startTransition={startFilterTransition} />
      {isFiltering ? (
        <TableSkeleton headers={PROCESSOS_HEADERS} />
      ) : (
        <Suspense fallback={<TableSkeleton headers={PROCESSOS_HEADERS} />}>
          <ProcessosTableAsync itemsPromise={itemsPromise} onEdit={openEdit} />
        </Suspense>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar processo' : 'Novo processo'}</DialogTitle>
          </DialogHeader>
          <ProcessoForm
            processo={editing ?? undefined}
            onSaved={handleSaved}
            onError={(message) => toast.error(message)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
