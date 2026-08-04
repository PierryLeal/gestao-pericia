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
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: CalendarEventDetails;
};

export function periciaToEvent(item: PericiaListItem): CalendarEvent {
  const color = SITUACAO_COLORS[item.situacao];
  return {
    id: String(item.id),
    title: `${item.processo.numero} — ${item.perito.nome}`,
    start: `${item.dataAgendada}T${item.horaAgendada}`,
    backgroundColor: color,
    borderColor: color,
    extendedProps: {
      processoNumero: item.processo.numero,
      peritoNome: item.perito.nome,
      colaboradorNome: item.colaborador?.nome ?? null,
      municipioNome: item.municipio.nome,
      municipioUf: item.municipio.uf,
      horaAgendada: item.horaAgendada ?? '',
      situacao: item.situacao,
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
