import { listColaboradores } from '@/features/colaboradores/actions';
import { ColaboradoresScreen } from '@/features/colaboradores/components/colaboradores-screen';

export default function ColaboradoresPage() {
  const itemsPromise = listColaboradores();
  return <ColaboradoresScreen itemsPromise={itemsPromise} />;
}
