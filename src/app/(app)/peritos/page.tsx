import { listPeritos } from '@/features/peritos/actions';
import { PeritosScreen } from '@/features/peritos/components/peritos-screen';

export default function PeritosPage() {
  const itemsPromise = listPeritos();
  return <PeritosScreen itemsPromise={itemsPromise} />;
}
