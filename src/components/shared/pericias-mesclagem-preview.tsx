import { StatusBadge } from '@/components/shared/status-badge';
import type { PericiaResumoMesclagem } from '@/features/pericias/actions';

export function PericiasMesclagemPreview({
  pericias,
  nomeSobrevivente,
}: {
  pericias: PericiaResumoMesclagem[];
  nomeSobrevivente: string;
}) {
  if (pericias.length === 0) {
    return (
      <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        Nenhuma perícia será afetada por esta mesclagem.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {pericias.length} {pericias.length === 1 ? 'perícia será reatribuída' : 'perícias serão reatribuídas'}{' '}
        para <strong className="font-medium text-foreground">{nomeSobrevivente}</strong>:
      </p>
      <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border p-2">
        {pericias.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{p.processoNumero}</p>
              <p className="text-xs text-muted-foreground">
                {p.dataAgendada ? new Date(`${p.dataAgendada}T00:00`).toLocaleDateString('pt-BR') : 'Sem data'}
                {p.horaAgendada ? ` às ${p.horaAgendada.slice(0, 5)}` : ''} · atualmente com {p.donoAtual}
              </p>
            </div>
            <StatusBadge situacao={p.situacao} />
          </div>
        ))}
      </div>
    </div>
  );
}
