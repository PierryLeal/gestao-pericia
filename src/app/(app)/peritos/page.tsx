import { listPeritos } from '@/features/peritos/actions';
import { PeritosScreen } from '@/features/peritos/components/peritos-screen';

export default async function PeritosPage() {
  const items = await listPeritos();
  return <PeritosScreen items={items} />;
}
