import { listPericias, getPericiaForEdit } from '@/features/pericias/actions';
import { listPeritosOptions } from '@/features/peritos/actions';
import { listColaboradoresOptions } from '@/features/colaboradores/actions';
import { PericiasScreen } from '@/features/pericias/components/pericias-screen';

export default async function PericiasPage({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string; busca?: string }>;
}) {
  const { situacao, busca } = await searchParams;
  const itemsPromise = listPericias({ situacao, busca });
  const [peritos, colaboradores] = await Promise.all([
    listPeritosOptions(),
    listColaboradoresOptions(),
  ]);

  return (
    <PericiasScreen
      itemsPromise={itemsPromise}
      peritos={peritos}
      colaboradores={colaboradores}
      getPericiaForEdit={getPericiaForEdit}
    />
  );
}
