import { Badge } from '@/components/ui/badge';
import type { PericiaListItem } from '@/features/pericias/actions';

const STYLES: Record<PericiaListItem['situacao'], string> = {
  pendente: 'bg-[var(--status-pendente)]/15 text-[var(--status-pendente)]',
  marcada: 'bg-[var(--status-marcada)]/15 text-[var(--status-marcada)]',
  realizada: 'bg-[var(--status-realizada)]/15 text-[var(--status-realizada)]',
  cancelada: 'bg-[var(--status-cancelada)]/15 text-[var(--status-cancelada)]',
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
