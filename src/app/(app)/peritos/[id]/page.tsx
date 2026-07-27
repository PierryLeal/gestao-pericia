import { notFound } from 'next/navigation';
import { getPerito } from '@/features/peritos/actions';
import { PeritoForm } from '@/features/peritos/components/perito-form';

export default async function EditarPeritoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perito = await getPerito(Number(id));
  if (!perito) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Editar perito</h1>
      <PeritoForm perito={perito} />
    </div>
  );
}
