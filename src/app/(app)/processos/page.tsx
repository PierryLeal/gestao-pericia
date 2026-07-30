import { listProcessos } from '@/features/processos/actions';
import { ProcessosScreen } from '@/features/processos/components/processos-screen';

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const itemsPromise = listProcessos(busca);
  return <ProcessosScreen itemsPromise={itemsPromise} />;
}
