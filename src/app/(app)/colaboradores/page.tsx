import Link from 'next/link';
import { listColaboradores } from '@/features/colaboradores/actions';
import { ColaboradoresTable } from '@/features/colaboradores/components/colaboradores-table';
import { Button } from '@/components/ui/button';

export default async function ColaboradoresPage() {
  const items = await listColaboradores();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        <Button render={<Link href="/colaboradores/novo" />}>Novo colaborador</Button>
      </div>
      <ColaboradoresTable items={items} />
    </div>
  );
}
