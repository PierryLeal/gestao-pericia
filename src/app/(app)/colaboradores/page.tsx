import { listColaboradores } from '@/features/colaboradores/actions';
import { ColaboradoresScreen } from '@/features/colaboradores/components/colaboradores-screen';

export default async function ColaboradoresPage() {
  const items = await listColaboradores();
  return <ColaboradoresScreen items={items} />;
}
