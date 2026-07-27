import { listProfiles } from '@/features/perfis/actions';
import { PerfisTable } from '@/features/perfis/components/perfis-table';

export default async function PerfisPage() {
  const profiles = await listProfiles();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Controle de perfis</h1>
      <PerfisTable profiles={profiles} />
    </div>
  );
}
