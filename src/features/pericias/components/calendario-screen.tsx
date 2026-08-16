'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PericiaForm } from './pericia-form';
import { CalendarioFilters, type CalendarioFiltersValue } from './calendario-filters';
import { renderCalendarEventContent } from './calendario-event-content';
import { getColaboradoresIndisponiveis, updatePericia } from '../actions';
import type { PericiaListItem, EditingPericia } from '../actions';
import { splitAgendadasNaoAgendadas, formatDateLocal, formatTimeLocal } from '../lib/calendario-mapping';
import { formatarNumeroProcesso, rotuloNumeroProcesso } from '@/lib/processo-numero-provisorio';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };

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
    if (filters.busca && !formatarNumeroProcesso(item.processo?.numero).toLowerCase().includes(filters.busca.toLowerCase())) return false;
    if (filters.peritoId && item.perito?.id !== filters.peritoId) return false;
    if (filters.colaboradorId && !item.colaboradores.some((c) => c.id === filters.colaboradorId)) return false;
    if (filters.contrato && filters.contrato.length > 0 && !(item.contrato && filters.contrato.includes(item.contrato))) return false;
    return true;
  });
  const { events, unscheduled } = splitAgendadasNaoAgendadas(filteredItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingPericia | null>(null);
  const unscheduledContainerRef = useRef<HTMLDivElement>(null);

  async function handleReschedule(event: { id: string; start: Date | null }, revert: () => void) {
    try {
      const id = Number(event.id);
      const item = items.find((i) => i.id === id);
      if (!item || !event.start) {
        revert();
        return;
      }
      if (!item.processo || !item.municipio || !item.perito) {
        revert();
        toast.error('Complete o processo, o município e o perito desta perícia (em Editar) antes de agendar.');
        return;
      }

      const novaData = formatDateLocal(event.start);
      const novaHora = formatTimeLocal(event.start);

      if (item.colaboradores.length > 0) {
        const busyIds = await getColaboradoresIndisponiveis(
          novaData, novaHora, item.processo.id, id, item.perito.id, item.local, item.situacao
        );
        if (item.colaboradores.some((c) => busyIds.includes(c.id))) {
          revert();
          toast.error('Não é possível mover: o colaborador já está em outra perícia nesse dia e horário.');
          return;
        }
      }

      const result = await updatePericia(id, {
        processoId: item.processo.id,
        municipioId: item.municipio.id,
        peritoId: item.perito.id,
        colaboradorIds: item.colaboradores.map((c) => c.id),
        dataAgendada: novaData,
        horaAgendada: novaHora,
        situacao: item.situacao,
        observacoes: item.observacoes,
        contrato: item.contrato,
        local: item.local,
      });
      if (!result.success) {
        revert();
        toast.error(result.error);
        return;
      }
      toast.success('Perícia reagendada');
      router.refresh();
    } catch {
      revert();
      toast.error('Não foi possível reagendar a perícia.');
    }
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
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full shrink-0 lg:w-64">
          <Card size="sm">
            <CardContent className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Não agendadas</h2>
              <div ref={unscheduledContainerRef} className="max-h-[70vh] space-y-2 overflow-y-auto">
                {unscheduled.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma perícia sem data.</p>
                )}
                {unscheduled.map((item) => {
                  const rotulo = `${rotuloNumeroProcesso(item.processo?.numero, 'Sem processo')} — ${item.perito?.nome ?? 'Sem perito'}`;
                  const temProblema = item.problemas.length > 0;
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            data-pericia-id={item.id}
                            data-title={rotulo}
                            onClick={() => openEdit(item.id)}
                            className={
                              'calendario-nao-agendada-item block w-full cursor-pointer truncate rounded-md border p-2 text-left text-sm hover:bg-accent' +
                              (temProblema ? ' border-destructive/50 bg-destructive/10' : '')
                            }
                          />
                        }
                      >
                        {rotulo}
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {rotulo}
                        {temProblema && (
                          <ul className="mt-1 list-disc pl-3 text-destructive">
                            {item.problemas.map((problema) => (
                              <li key={problema}>{problema}</li>
                            ))}
                          </ul>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="min-w-0 flex-1">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={ptBrLocale}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={events}
            eventContent={renderCalendarEventContent}
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
