import { listPericias, getPericiaForEdit } from '@/features/pericias/actions';
import { listPeritosOptions } from '@/features/peritos/actions';
import { listColaboradoresOptions } from '@/features/colaboradores/actions';
import { getMunicipioById } from '@/features/municipios/actions';
import { parseContratos } from '@/lib/contratos';
import { PericiasScreen } from '@/features/pericias/components/pericias-screen';

export default async function PericiasPage({
  searchParams,
}: {
  searchParams: Promise<{
    situacao?: string; busca?: string; dataInicio?: string; dataFim?: string;
    municipioId?: string; peritoId?: string; colaboradorId?: string; contrato?: string;
  }>;
}) {
  const { situacao, busca, dataInicio, dataFim, municipioId, peritoId, colaboradorId, contrato } = await searchParams;
  const itemsPromise = listPericias({
    situacao,
    busca,
    dataInicio,
    dataFim,
    municipioId: municipioId ? Number(municipioId) : undefined,
    peritoId: peritoId ? Number(peritoId) : undefined,
    colaboradorId: colaboradorId ? Number(colaboradorId) : undefined,
    contrato: parseContratos(contrato),
  });
  const [peritos, colaboradores, municipio] = await Promise.all([
    listPeritosOptions(),
    listColaboradoresOptions(),
    municipioId ? getMunicipioById(Number(municipioId)) : Promise.resolve(null),
  ]);

  return (
    <PericiasScreen
      itemsPromise={itemsPromise}
      peritos={peritos}
      colaboradores={colaboradores}
      municipio={municipio}
      getPericiaForEdit={getPericiaForEdit}
    />
  );
}
