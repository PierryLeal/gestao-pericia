import { listColaboradores } from '@/features/colaboradores/actions';
import { ColaboradoresScreen } from '@/features/colaboradores/components/colaboradores-screen';

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const itemsPromise = listColaboradores(busca);
  return <ColaboradoresScreen itemsPromise={itemsPromise} />;
}
