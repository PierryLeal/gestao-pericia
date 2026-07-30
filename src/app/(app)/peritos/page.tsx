import { listPeritos } from '@/features/peritos/actions';
import { PeritosScreen } from '@/features/peritos/components/peritos-screen';

export default async function PeritosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const itemsPromise = listPeritos(busca);
  return <PeritosScreen itemsPromise={itemsPromise} />;
}
