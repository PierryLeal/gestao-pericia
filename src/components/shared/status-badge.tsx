import { Badge } from '@/components/ui/badge';
import type { PericiaListItem } from '@/features/pericias/actions';

const STYLES: Record<PericiaListItem['situacao'], string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  marcada: 'bg-blue-100 text-blue-800',
  realizada: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800',
};

const LABELS: Record<PericiaListItem['situacao'], string> = {
  pendente: 'Pendente',
  marcada: 'Marcada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export function StatusBadge({ situacao }: { situacao: PericiaListItem['situacao'] }) {
  return <Badge className={STYLES[situacao]}>{LABELS[situacao]}</Badge>;
}
