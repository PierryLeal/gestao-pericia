'use client';

import { use, useState } from 'react';
import { Pencil, Trash2, Merge } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PaginationControls } from '@/components/shared/pagination-controls';
import { paginar, totalDePaginas, ITENS_POR_PAGINA_PADRAO } from '@/lib/paginar';
import { formatPhone } from '@/lib/masks';
import type { Colaborador } from '../actions';

export function ColaboradoresTableAsync({
  itemsPromise,
  onEdit,
  onDelete,
  onMerge,
}: {
  itemsPromise: Promise<Colaborador[]>;
  onEdit: (colaborador: Colaborador) => void;
  onDelete: (colaborador: Colaborador) => Promise<void>;
  onMerge: (colaborador: Colaborador) => void;
}) {
  const items = use(itemsPromise);
  return <ColaboradoresTable items={items} onEdit={onEdit} onDelete={onDelete} onMerge={onMerge} />;
}

export function ColaboradoresTable({
  items,
  onEdit,
  onDelete,
  onMerge,
}: {
  items: Colaborador[];
  onEdit: (colaborador: Colaborador) => void;
  onDelete: (colaborador: Colaborador) => Promise<void>;
  onMerge: (colaborador: Colaborador) => void;
}) {
  const [confirmTarget, setConfirmTarget] = useState<Colaborador | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pagina, setPagina] = useState(1);

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum colaborador cadastrado.</p>;
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
            <TableHead>Nome</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Formação</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {itensDaPagina.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.nome}</TableCell>
              <TableCell>{formatPhone(item.contato)}</TableCell>
              <TableCell>{item.formacao}</TableCell>
              <TableCell>{item.email}</TableCell>
              <TableCell>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                  <Pencil className="size-4" />
                  <span className="sr-only">Editar {item.nome}</span>
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMerge(item)}>
                  <Merge className="size-4" />
                  <span className="sr-only">Mesclar {item.nome} com outro colaborador</span>
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmTarget(item)}>
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir {item.nome}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaginationControls
        paginaAtual={paginaEfetiva}
        totalPaginas={totalPaginas}
        total={items.length}
        rotulo={items.length === 1 ? 'colaborador' : 'colaboradores'}
        onPageChange={setPagina}
      />
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Excluir colaborador"
        description={`Excluir "${confirmTarget?.nome}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
