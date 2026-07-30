import { listProcessos } from '@/features/processos/actions';
import { ProcessosScreen } from '@/features/processos/components/processos-screen';

export default function ProcessosPage() {
  const itemsPromise = listProcessos();
  return <ProcessosScreen itemsPromise={itemsPromise} />;
}
