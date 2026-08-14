import { rotuloNumeroProcesso } from '@/lib/processo-numero-provisorio';
import type { PericiaListItem } from '../actions';

const SITUACAO_COLORS: Record<PericiaListItem['situacao'], string> = {
  pendente: 'var(--status-pendente)',
  marcada: 'var(--status-marcada)',
  realizada: 'var(--status-realizada)',
  cancelada: 'var(--status-cancelada)',
};

export type CalendarEventDetails = {
  processoNumero: string;
  peritoNome: string;
  colaboradorNome: string | null;
  municipioNome: string;
  municipioUf: string;
  horaAgendada: string;
  situacao: PericiaListItem['situacao'];
  problemas: string[];
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: CalendarEventDetails;
};

// A bulk-imported pericia can be scheduled (has data/hora) yet still be
// missing its processo/município/perito — a red border on the calendar
// event flags that at a glance, same as the "não agendadas" sidebar.
const COR_PROBLEMA = 'var(--destructive)';

export function periciaToEvent(item: PericiaListItem): CalendarEvent {
  const color = item.problemas.length > 0 ? COR_PROBLEMA : SITUACAO_COLORS[item.situacao];
  const processoNumero = rotuloNumeroProcesso(item.processo?.numero, 'Sem processo');
  const peritoNome = item.perito?.nome ?? 'Sem perito';
  return {
    id: String(item.id),
    title: `${processoNumero} — ${peritoNome}`,
    start: `${item.dataAgendada}T${item.horaAgendada}`,
    backgroundColor: color,
    borderColor: color,
    extendedProps: {
      processoNumero,
      peritoNome,
      colaboradorNome: item.colaboradores.length > 0 ? item.colaboradores.map((c) => c.nome).join(', ') : null,
      municipioNome: item.municipio?.nome ?? 'Sem município',
      municipioUf: item.municipio?.uf ?? '',
      horaAgendada: item.horaAgendada ?? '',
      situacao: item.situacao,
      problemas: item.problemas,
    },
  };
}

export function splitAgendadasNaoAgendadas(items: PericiaListItem[]): {
  events: CalendarEvent[];
  unscheduled: PericiaListItem[];
} {
  const events: CalendarEvent[] = [];
  const unscheduled: PericiaListItem[] = [];
  for (const item of items) {
    if (item.dataAgendada && item.horaAgendada) {
      events.push(periciaToEvent(item));
    } else {
      unscheduled.push(item);
    }
  }
  return { events, unscheduled };
}

export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTimeLocal(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}
