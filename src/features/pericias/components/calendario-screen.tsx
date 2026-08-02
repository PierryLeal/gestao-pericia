'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PericiaForm } from './pericia-form';
import type { PericiaListItem } from '../actions';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';
import type { PericiaInput } from '../schemas';
import { splitAgendadasNaoAgendadas } from '../lib/calendario-mapping';

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
  const { events, unscheduled } = splitAgendadasNaoAgendadas(items);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingPericia | null>(null);

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
      <div className="flex gap-4">
        <div className="w-64 shrink-0 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Não agendadas</h2>
          <div className="space-y-2">
            {unscheduled.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openEdit(item.id)}
                className="w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
              >
                {item.processo.numero} — {item.perito.nome}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            events={events}
            eventClick={(info) => openEdit(Number(info.event.id))}
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
