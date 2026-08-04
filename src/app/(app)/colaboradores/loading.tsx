import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/shared/table-skeleton';
import { ColaboradoresFilters } from '@/features/colaboradores/components/colaboradores-filters';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        <Button type="button" disabled>
          <Plus className="size-4" />
          Novo colaborador
        </Button>
      </div>
      <ColaboradoresFilters />
      <TableSkeleton headers={['Nome', 'Contato', 'Formação', '']} />
    </div>
  );
}
