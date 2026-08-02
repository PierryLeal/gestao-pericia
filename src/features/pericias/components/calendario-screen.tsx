'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { PericiaListItem } from '../actions';
import { splitAgendadasNaoAgendadas } from '../lib/calendario-mapping';

export function CalendarioScreen({ items }: { items: PericiaListItem[] }) {
  const { events } = splitAgendadasNaoAgendadas(items);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calendário</h1>
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        events={events}
        height="auto"
      />
    </div>
  );
}
