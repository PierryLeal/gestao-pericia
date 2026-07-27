import Link from 'next/link';
import { listPericias } from '@/features/pericias/actions';
import { PericiasTable } from '@/features/pericias/components/pericias-table';
import { PericiasFilters } from '@/features/pericias/components/pericias-filters';
import { Button } from '@/components/ui/button';

export default async function PericiasPage({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string; busca?: string }>;
}) {
  const { situacao, busca } = await searchParams;
  const items = await listPericias({ situacao, busca });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perícias</h1>
        <Button render={<Link href="/pericias/nova" />} nativeButton={false}>Nova perícia</Button>
      </div>
      <PericiasFilters />
      <PericiasTable items={items} />
    </div>
  );
}
