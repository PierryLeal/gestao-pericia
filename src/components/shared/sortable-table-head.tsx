'use client';

import { ChevronUp, ChevronDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { DirecaoOrdenacao } from '@/lib/ordenar';

/**
 * A column header with clickable up/down sort arrows. Up highlighted =
 * ascending, down highlighted = descending, both dim (neither highlighted) =
 * unsorted — clicking the currently-highlighted arrow again returns to that
 * neutral state instead of just flipping direction.
 */
export function SortableTableHead({
  label,
  direcao,
  onOrdenar,
  className,
}: {
  label: string;
  direcao: DirecaoOrdenacao | null;
  onOrdenar: (direcao: DirecaoOrdenacao) => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <div className="flex items-center gap-0.5">
        <span>{label}</span>
        <span className="flex flex-col">
          <button
            type="button"
            onClick={() => onOrdenar('asc')}
            aria-label={`Ordenar ${label} em ordem crescente`}
            aria-pressed={direcao === 'asc'}
            className={cn(
              '-mb-1 leading-none',
              direcao === 'asc' ? 'text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'
            )}
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onOrdenar('desc')}
            aria-label={`Ordenar ${label} em ordem decrescente`}
            aria-pressed={direcao === 'desc'}
            className={cn(
              'leading-none',
              direcao === 'desc' ? 'text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'
            )}
          >
            <ChevronDown className="size-3.5" />
          </button>
        </span>
      </div>
    </TableHead>
  );
}
