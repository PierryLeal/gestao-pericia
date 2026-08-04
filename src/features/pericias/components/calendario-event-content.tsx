import type { EventContentArg } from '@fullcalendar/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/shared/status-badge';
import type { CalendarEventDetails } from '../lib/calendario-mapping';

export function renderCalendarEventContent(arg: EventContentArg) {
  const details = arg.event.extendedProps as CalendarEventDetails;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<div className="flex min-w-0 items-center gap-1 border-b border-black/10 px-px py-0.5" />}
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: arg.borderColor || arg.backgroundColor }}
        />
        <span className="truncate">{arg.event.title}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs space-y-1">
        <p className="font-medium">
          {details.processoNumero} — {details.peritoNome}
        </p>
        <p>Colaborador: {details.colaboradorNome ?? 'Nenhum'}</p>
        <p>
          {details.municipioNome}/{details.municipioUf} às {details.horaAgendada}
        </p>
        <StatusBadge situacao={details.situacao} />
      </TooltipContent>
    </Tooltip>
  );
}
