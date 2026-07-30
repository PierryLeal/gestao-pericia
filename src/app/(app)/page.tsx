import { listPericias, getPericiaForEdit } from '@/features/pericias/actions';
import { listPeritosOptions } from '@/features/peritos/actions';
import { listColaboradoresOptions } from '@/features/colaboradores/actions';
import { PericiasScreen } from '@/features/pericias/components/pericias-screen';

export default async function PericiasPage({
  searchParams,
}: {
  searchParams: Promise<{
    situacao?: string; busca?: string; data?: string;
    municipioId?: string; peritoId?: string; colaboradorId?: string;
  }>;
}) {
  const { situacao, busca, data, municipioId, peritoId, colaboradorId } = await searchParams;
  const itemsPromise = listPericias({
    situacao,
    busca,
    data,
    municipioId: municipioId ? Number(municipioId) : undefined,
    peritoId: peritoId ? Number(peritoId) : undefined,
    colaboradorId: colaboradorId ? Number(colaboradorId) : undefined,
  });
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
