import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/shared/table-skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Processos</h1>
        <Button type="button" disabled>
          <Plus className="size-4" />
          Novo processo
        </Button>
      </div>
      <TableSkeleton columns={4} />
    </div>
  );
}
