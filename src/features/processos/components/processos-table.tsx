'use client';

import { use, useState } from 'react';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PaginationControls } from '@/components/shared/pagination-controls';
import { paginar, totalDePaginas, ITENS_POR_PAGINA_PADRAO } from '@/lib/paginar';
import { isNumeroProvisorio, rotuloNumeroProcesso } from '@/lib/processo-numero-provisorio';
import { cn } from '@/lib/utils';
import type { Processo } from '../actions';

export function ProcessosTableAsync({
  itemsPromise,
  onEdit,
  onDelete,
}: {
  itemsPromise: Promise<Processo[]>;
  onEdit: (processo: Processo) => void;
  onDelete: (processo: Processo) => Promise<void>;
}) {
  const items = use(itemsPromise);
  return <ProcessosTable items={items} onEdit={onEdit} onDelete={onDelete} />;
}

export function ProcessosTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Processo[];
  onEdit: (processo: Processo) => void;
  onDelete: (processo: Processo) => Promise<void>;
}) {
  const [confirmTarget, setConfirmTarget] = useState<Processo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pagina, setPagina] = useState(1);

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum processo cadastrado.</p>;
  }

  const totalPaginas = totalDePaginas(items.length, ITENS_POR_PAGINA_PADRAO);
  const paginaEfetiva = Math.min(pagina, totalPaginas);
  const itensDaPagina = paginar(items, paginaEfetiva, ITENS_POR_PAGINA_PADRAO);

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await onDelete(confirmTarget);
    } finally {
      setDeleting(false);
      setConfirmTarget(null);
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Autor</TableHead>
            <TableHead>Réu</TableHead>
            <TableHead>Escritório</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {itensDaPagina.map((item) => {
            const numeroNaoIdentificado = isNumeroProvisorio(item.numero);
            const numeroRotulo = rotuloNumeroProcesso(item.numero, 'processo sem número identificado');
            return (
            <TableRow key={item.id} className={cn(numeroNaoIdentificado && 'bg-destructive/10')}>
              <TableCell>
                {numeroNaoIdentificado ? (
                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger render={<span className="inline-flex" />}>
                        <AlertTriangle className="size-4 shrink-0 text-destructive" />
                        <span className="sr-only">Número não identificado</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Número do processo não identificado na importação — edite para preencher.
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-muted-foreground italic">Não identificado</span>
                  </div>
                ) : (
                  <span>{item.numero}</span>
                )}
              </TableCell>
              <TableCell>{item.autor}</TableCell>
              <TableCell>{item.reu}</TableCell>
              <TableCell>{item.escritorio}</TableCell>
              <TableCell>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                  <Pencil className="size-4" />
                  <span className="sr-only">Editar {numeroRotulo}</span>
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmTarget(item)}>
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir {numeroRotulo}</span>
                </Button>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <PaginationControls
        paginaAtual={paginaEfetiva}
        totalPaginas={totalPaginas}
        total={items.length}
        rotulo={items.length === 1 ? 'processo' : 'processos'}
        onPageChange={setPagina}
      />
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Excluir processo"
        description={`Excluir o processo "${rotuloNumeroProcesso(confirmTarget?.numero, 'sem número identificado')}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
