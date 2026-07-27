import { notFound } from 'next/navigation';
import { getPericiaForEdit } from '@/features/pericias/actions';
import { listPeritosOptions } from '@/features/peritos/actions';
import { listColaboradoresOptions } from '@/features/colaboradores/actions';
import { PericiaForm } from '@/features/pericias/components/pericia-form';

export default async function EditarPericiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pericia, peritos, colaboradores] = await Promise.all([
    getPericiaForEdit(Number(id)),
    listPeritosOptions(),
    listColaboradoresOptions(),
  ]);
  if (!pericia) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Editar perícia</h1>
      <PericiaForm pericia={pericia} peritos={peritos} colaboradores={colaboradores} />
    </div>
  );
}
