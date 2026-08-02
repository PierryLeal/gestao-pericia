import { listPericias, getPericiaForEdit } from '@/features/pericias/actions';
import { listPeritosOptions } from '@/features/peritos/actions';
import { listColaboradoresOptions } from '@/features/colaboradores/actions';
import { CalendarioScreen } from '@/features/pericias/components/calendario-screen';

export default async function CalendarioPage() {
  const [items, peritos, colaboradores] = await Promise.all([
    listPericias(),
    listPeritosOptions(),
    listColaboradoresOptions(),
  ]);
  return (
    <CalendarioScreen
      items={items}
      peritos={peritos}
      colaboradores={colaboradores}
      getPericiaForEdit={getPericiaForEdit}
    />
  );
}
