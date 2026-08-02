import { listPericias } from '@/features/pericias/actions';
import { CalendarioScreen } from '@/features/pericias/components/calendario-screen';

export default async function CalendarioPage() {
  const items = await listPericias();
  return <CalendarioScreen items={items} />;
}
