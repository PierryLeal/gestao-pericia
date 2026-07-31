'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TableSkeleton } from '@/components/shared/table-skeleton';
import { PericiasTableAsync } from './pericias-table';
import { PericiasFilters } from './pericias-filters';
import { PericiaForm } from './pericia-form';
import { deletePericia, type PericiaListItem } from '../actions';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';
import type { PericiaInput } from '../schemas';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };
type EditingPericia = PericiaInput & { id: number; processo: Processo; municipio: MunicipioIBGE };

const PERICIAS_HEADERS = ['', 'Nº Processo', 'Data - Hora', 'Local', 'Perito', 'Colaborador', 'Situação', ''];

export function PericiasScreen({
  itemsPromise,
  peritos,
  colaboradores,
  municipio,
  getPericiaForEdit,
}: {
  itemsPromise: Promise<PericiaListItem[]>;
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
  municipio: MunicipioIBGE | null;
  getPericiaForEdit: (id: number) => Promise<EditingPericia | null>;
}) {
  const router = useRouter();
  const [isFiltering, startFilterTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingPericia | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function openEdit(item: PericiaListItem) {
    setLoadingEdit(true);
    const full = await getPericiaForEdit(item.id);
    setLoadingEdit(false);
    if (!full) {
      toast.error('Não foi possível carregar essa perícia.');
      return;
    }
    setEditing(full);
    setDialogOpen(true);
  }

  function handleSaved() {
    toast.success(editing ? 'Perícia atualizada' : 'Perícia criada');
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete(item: PericiaListItem) {
    const result = await deletePericia(item.id);
    if (result.success) {
      toast.success('Perícia excluída');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perícias</h1>
        <Button type="button" onClick={openCreate} disabled={loadingEdit}>
          <Plus className="size-4" />
          Nova perícia
        </Button>
      </div>
      <PericiasFilters
        peritos={peritos}
        colaboradores={colaboradores}
        municipio={municipio}
        startTransition={startFilterTransition}
      />
      {isFiltering ? (
        <TableSkeleton headers={PERICIAS_HEADERS} />
      ) : (
        <Suspense fallback={<TableSkeleton headers={PERICIAS_HEADERS} />}>
          <PericiasTableAsync itemsPromise={itemsPromise} onEdit={openEdit} onDelete={handleDelete} />
        </Suspense>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar perícia' : 'Nova perícia'}</DialogTitle>
          </DialogHeader>
          <PericiaForm
            pericia={editing ?? undefined}
            peritos={peritos}
            colaboradores={colaboradores}
            onSaved={handleSaved}
            onError={(message) => toast.error(message)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
