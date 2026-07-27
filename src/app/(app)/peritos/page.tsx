import Link from 'next/link';
import { listPeritos } from '@/features/peritos/actions';
import { PeritosTable } from '@/features/peritos/components/peritos-table';
import { Button } from '@/components/ui/button';

export default async function PeritosPage() {
  const items = await listPeritos();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Peritos</h1>
        <Button render={<Link href="/peritos/novo" />} nativeButton={false}>Novo perito</Button>
      </div>
      <PeritosTable items={items} />
    </div>
  );
}
