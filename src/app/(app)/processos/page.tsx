import { listProcessos } from '@/features/processos/actions';
import { ProcessosScreen } from '@/features/processos/components/processos-screen';

export default async function ProcessosPage() {
  const items = await listProcessos();
  return <ProcessosScreen items={items} />;
}
