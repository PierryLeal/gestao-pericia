import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/shared/table-skeleton';
import { PericiasFilters } from '@/features/pericias/components/pericias-filters';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perícias</h1>
        <Button type="button" disabled>
          <Plus className="size-4" />
          Nova perícia
        </Button>
      </div>
      <PericiasFilters />
      <TableSkeleton columns={8} />
    </div>
  );
}
