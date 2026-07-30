'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TableSkeleton } from '@/components/shared/table-skeleton';
import { PeritosTableAsync } from './peritos-table';
import { PeritosFilters } from './peritos-filters';
import { PeritoForm } from './perito-form';
import type { Perito } from '../actions';

const PERITOS_HEADERS = ['Nome', 'Contato', 'Formação', 'CREA', 'Relação', 'Resultados', ''];

export function PeritosScreen({ itemsPromise }: { itemsPromise: Promise<Perito[]> }) {
  const router = useRouter();
  const [isFiltering, startFilterTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Perito | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(perito: Perito) {
    setEditing(perito);
    setDialogOpen(true);
  }

  function handleSaved() {
    toast.success(editing ? 'Perito atualizado' : 'Perito criado');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Peritos</h1>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          Novo perito
        </Button>
      </div>
      <PeritosFilters startTransition={startFilterTransition} />
      {isFiltering ? (
        <TableSkeleton headers={PERITOS_HEADERS} />
      ) : (
        <Suspense fallback={<TableSkeleton headers={PERITOS_HEADERS} />}>
          <PeritosTableAsync itemsPromise={itemsPromise} onEdit={openEdit} />
        </Suspense>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar perito' : 'Novo perito'}</DialogTitle>
          </DialogHeader>
          <PeritoForm perito={editing ?? undefined} onSaved={handleSaved} onError={(message) => toast.error(message)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
