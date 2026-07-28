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
  const [items, peritos, colaboradores] = await Promise.all([
    listPericias({ situacao, busca }),
    listPeritosOptions(),
    listColaboradoresOptions(),
  ]);

  return (
    <PericiasScreen
      items={items}
      peritos={peritos}
      colaboradores={colaboradores}
      getPericiaForEdit={getPericiaForEdit}
    />
  );
}
