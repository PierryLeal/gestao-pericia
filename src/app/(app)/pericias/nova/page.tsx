import { PericiaForm } from '@/features/pericias/components/pericia-form';
import { listPeritosOptions } from '@/features/peritos/actions';
import { listColaboradoresOptions } from '@/features/colaboradores/actions';

export default async function NovaPericiaPage() {
  const [peritos, colaboradores] = await Promise.all([listPeritosOptions(), listColaboradoresOptions()]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nova perícia</h1>
      <PericiaForm peritos={peritos} colaboradores={colaboradores} />
    </div>
  );
}
