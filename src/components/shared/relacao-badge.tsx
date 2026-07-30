import { Badge } from '@/components/ui/badge';
import type { PeritoRelacao } from '@/lib/supabase/database.types';

const STYLES: Record<PeritoRelacao, string> = {
  ruim: 'bg-[var(--status-cancelada)]/15 text-[var(--status-cancelada)]',
  neutra: 'bg-muted-foreground/15 text-muted-foreground',
  boa: 'bg-[var(--status-marcada)]/15 text-[var(--status-marcada)]',
  otima: 'bg-[var(--status-realizada)]/15 text-[var(--status-realizada)]',
};

const LABELS: Record<PeritoRelacao, string> = {
  ruim: 'Ruim',
  neutra: 'Neutra',
  boa: 'Boa',
  otima: 'Ótima',
};

export function RelacaoBadge({ relacao }: { relacao: PeritoRelacao }) {
  return <Badge className={STYLES[relacao]}>{LABELS[relacao]}</Badge>;
}
