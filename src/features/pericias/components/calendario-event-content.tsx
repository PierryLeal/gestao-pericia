import type { EventContentArg } from '@fullcalendar/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/shared/status-badge';
import type { CalendarEventDetails } from '../lib/calendario-mapping';

export function renderCalendarEventContent(arg: EventContentArg) {
  const details = arg.event.extendedProps as Partial<CalendarEventDetails>;
  // While an unscheduled pericia is being dragged from the sidebar, FullCalendar
  // renders a drop-preview chip in the target cell using only the {id, title}
  // handed to the Draggable — extendedProps (including `problemas`) isn't
  // populated yet, so this must tolerate a partial/empty details object instead
  // of assuming the full shape used once the event is actually on the calendar.
  const problemas = details.problemas ?? [];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="mx-1 my-px flex min-w-0 items-center gap-1 rounded border border-black/10 px-1.5 py-0.5" />
        }
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: arg.borderColor || arg.backgroundColor }}
        />
        <span className="truncate">{arg.event.title}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="w-64 max-w-none flex-col items-start gap-1.5 p-3">
        <p className="font-medium">
          {details.processoNumero} — {details.peritoNome}
        </p>
        <p>Colaborador: {details.colaboradorNome ?? 'Nenhum'}</p>
        <p>
          {details.municipioNome}/{details.municipioUf} às {details.horaAgendada}
        </p>
        {details.situacao && <StatusBadge situacao={details.situacao} />}
        {problemas.length > 0 && (
          <ul className="list-disc pl-3 text-destructive">
            {problemas.map((problema) => (
              <li key={problema}>{problema}</li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
