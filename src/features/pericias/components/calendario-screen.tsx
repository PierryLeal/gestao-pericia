'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PericiaForm } from './pericia-form';
import { CalendarioFilters, type CalendarioFiltersValue } from './calendario-filters';
import { getColaboradoresIndisponiveis, updatePericia } from '../actions';
import type { PericiaListItem } from '../actions';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';
import type { PericiaInput } from '../schemas';
import { splitAgendadasNaoAgendadas, formatDateLocal, formatTimeLocal } from '../lib/calendario-mapping';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };
type EditingPericia = PericiaInput & { id: number; processo: Processo; municipio: MunicipioIBGE };

export function CalendarioScreen({
  items,
  peritos,
  colaboradores,
  getPericiaForEdit,
}: {
  items: PericiaListItem[];
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
  getPericiaForEdit: (id: number) => Promise<EditingPericia | null>;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<CalendarioFiltersValue>({});
  const filteredItems = items.filter((item) => {
    if (filters.situacao && item.situacao !== filters.situacao) return false;
    if (filters.busca && !item.processo.numero.toLowerCase().includes(filters.busca.toLowerCase())) return false;
    if (filters.peritoId && item.perito.id !== filters.peritoId) return false;
    if (filters.colaboradorId && item.colaborador?.id !== filters.colaboradorId) return false;
    return true;
  });
  const { events, unscheduled } = splitAgendadasNaoAgendadas(filteredItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingPericia | null>(null);
  const unscheduledContainerRef = useRef<HTMLDivElement>(null);

  async function handleReschedule(event: { id: string; start: Date | null }, revert: () => void) {
    const id = Number(event.id);
    const item = items.find((i) => i.id === id);
    if (!item || !event.start) {
      revert();
      return;
    }
    const novaData = formatDateLocal(event.start);
    const novaHora = formatTimeLocal(event.start);

    if (item.colaborador) {
      const busyIds = await getColaboradoresIndisponiveis(novaData, novaHora, item.id);
      if (busyIds.includes(item.colaborador.id)) {
        revert();
        toast.error('Não é possível mover: o colaborador já está em outra perícia nesse dia e horário.');
        return;
      }
    }

    const result = await updatePericia(id, {
      processoId: item.processo.id,
      municipioId: item.municipio.id,
      peritoId: item.perito.id,
      colaboradorId: item.colaborador?.id ?? null,
      dataAgendada: novaData,
      horaAgendada: novaHora,
      situacao: item.situacao,
    });
    if (!result.success) {
      revert();
      toast.error(result.error);
      return;
    }
    toast.success('Perícia reagendada');
    router.refresh();
  }

  useEffect(() => {
    if (!unscheduledContainerRef.current) return;
    const draggable = new Draggable(unscheduledContainerRef.current, {
      itemSelector: '.calendario-nao-agendada-item',
      eventData: (el) => ({
        id: el.dataset.periciaId,
        title: el.dataset.title,
      }),
    });
    return () => draggable.destroy();
  }, []);

  async function openEdit(id: number) {
    const full = await getPericiaForEdit(id);
    if (!full) {
      toast.error('Não foi possível carregar essa perícia.');
      return;
    }
    setEditing(full);
    setDialogOpen(true);
  }

  function handleSaved() {
    toast.success('Perícia atualizada');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calendário</h1>
      <CalendarioFilters peritos={peritos} colaboradores={colaboradores} onChange={setFilters} />
      <div className="flex gap-4">
        <div className="w-64 shrink-0 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Não agendadas</h2>
          <div ref={unscheduledContainerRef} className="space-y-2">
            {unscheduled.map((item) => (
              <button
                key={item.id}
                type="button"
                data-pericia-id={item.id}
                data-title={`${item.processo.numero} — ${item.perito.nome}`}
                onClick={() => openEdit(item.id)}
                className="calendario-nao-agendada-item w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
              >
                {item.processo.numero} — {item.perito.nome}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={events}
            editable
            eventClick={(info) => openEdit(Number(info.event.id))}
            eventDrop={(info) => handleReschedule(info.event, info.revert)}
            eventReceive={(info) => handleReschedule(info.event, info.revert)}
            height="auto"
          />
        </div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar perícia</DialogTitle>
          </DialogHeader>
          {editing && (
            <PericiaForm
              pericia={editing}
              peritos={peritos}
              colaboradores={colaboradores}
              onSaved={handleSaved}
              onError={(message) => toast.error(message)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
