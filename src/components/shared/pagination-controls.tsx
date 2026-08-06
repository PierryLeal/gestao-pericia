'use client';

import { Button } from '@/components/ui/button';

export function PaginationControls({
  paginaAtual,
  totalPaginas,
  total,
  rotulo,
  onPageChange,
}: {
  paginaAtual: number;
  totalPaginas: number;
  total: number;
  rotulo: string;
  onPageChange: (pagina: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total} {rotulo}
      </span>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={paginaAtual <= 1}
            onClick={() => onPageChange(paginaAtual - 1)}
          >
            Anterior
          </Button>
          <span>
            Página {paginaAtual} de {totalPaginas}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={paginaAtual >= totalPaginas}
            onClick={() => onPageChange(paginaAtual + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
