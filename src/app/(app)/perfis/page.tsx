import { listProfiles } from '@/features/perfis/actions';
import { PerfisScreen } from '@/features/perfis/components/perfis-screen';

export default async function PerfisPage() {
  const profiles = await listProfiles();
  return <PerfisScreen profiles={profiles} />;
}
