import { Badge } from '@/components/ui/badge';
import type { PeritoResultado } from '@/lib/supabase/database.types';

const STYLES: Record<PeritoResultado, string> = {
  negativo: 'bg-[var(--status-cancelada)]/15 text-[var(--status-cancelada)]',
  parcial: 'bg-muted-foreground/15 text-muted-foreground',
  positivo: 'bg-[var(--status-realizada)]/15 text-[var(--status-realizada)]',
};

const LABELS: Record<PeritoResultado, string> = {
  negativo: 'Negativo',
  parcial: 'Parcial',
  positivo: 'Positivo',
};

export function ResultadoBadge({ resultado }: { resultado: PeritoResultado }) {
  return <Badge className={STYLES[resultado]}>{LABELS[resultado]}</Badge>;
}
