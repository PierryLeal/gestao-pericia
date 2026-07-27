import { notFound } from 'next/navigation';
import { getColaborador } from '@/features/colaboradores/actions';
import { ColaboradorForm } from '@/features/colaboradores/components/colaborador-form';

export default async function EditarColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const colaborador = await getColaborador(Number(id));
  if (!colaborador) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Editar colaborador</h1>
      <ColaboradorForm colaborador={colaborador} />
    </div>
  );
}
