'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MunicipioCombobox } from '@/features/municipios/components/municipio-combobox';
import { TooltipField } from '@/components/shared/tooltip-field';
import { situacaoOptions, type PericiaInput } from '../../pericias/schemas';
import { cn } from '@/lib/utils';
import { formatarNumeroProcesso, isNumeroProvisorio } from '@/lib/processo-numero-provisorio';
import type { PericiaPreviewRow } from '../types';

// A real spreadsheet import can be 1700+ rows — rendering every <TableRow> at
// once made this screen unusably slow. Only the rows currently in (or near)
// the scroll viewport are mounted; two spacer rows before/after stand in for
// the rest so the scrollbar size and column widths stay correct.
const ALTURA_LINHA_ESTIMADA = 64;
const NUMERO_COLUNAS = 13;

export function PericiasPreviewTable({
  linhas,
  onChange,
}: {
  linhas: PericiaPreviewRow[];
  onChange: (linhas: PericiaPreviewRow[]) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: linhas.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ALTURA_LINHA_ESTIMADA,
    overscan: 8,
  });

  function atualizarLinha(index: number, patch: Partial<PericiaPreviewRow>) {
    onChange(linhas.map((linha, i) => (i === index ? { ...linha, ...patch } : linha)));
  }

  function removerLinha(index: number) {
    onChange(linhas.filter((_, i) => i !== index));
  }

  const virtualRows = virtualizer.getVirtualItems();
  const alturaAntes = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const alturaDepois = virtualRows.length > 0 ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div
      ref={scrollRef}
      // The shared <Table> wraps itself in its own overflow-x-auto div. Left
      // alone, THAT div ends up owning the horizontal scrollbar — but its
      // height matches the full (virtual) row count, not the 70vh clipped
      // window, so the scrollbar sits far below anything ever visible.
      // Cancelling its overflow forces both axes up to this container.
      className="max-h-[70vh] overflow-auto rounded-md border [&_[data-slot=table-container]]:overflow-visible"
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead>Processo</TableHead>
            <TableHead>Autor</TableHead>
            <TableHead>Réu</TableHead>
            <TableHead>Data - Hora</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Perito</TableHead>
            <TableHead>Colaborador</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Obs.</TableHead>
            <TableHead>Escritório</TableHead>
            <TableHead>Contrato</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {alturaAntes > 0 && (
            <tr aria-hidden style={{ height: alturaAntes }}>
              <td colSpan={NUMERO_COLUNAS} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const index = virtualRow.index;
            const linha = linhas[index];
            return (
              <TableRow
                key={linha.linhaOriginal}
                data-index={index}
                ref={virtualizer.measureElement}
                className={cn(
                  linha.status === 'atencao' && 'bg-destructive/10',
                  linha.status === 'suspeito' && 'bg-amber-500/10',
                  linha.status === 'duplicada' && 'opacity-50'
                )}
              >
                <TableCell className="min-w-40">
                  <TooltipField value={formatarNumeroProcesso(linha.processoNumero)}>
                    <Input
                      value={formatarNumeroProcesso(linha.processoNumero)}
                      placeholder={isNumeroProvisorio(linha.processoNumero) ? 'não identificado — edite se souber o número' : undefined}
                      onChange={(e) => atualizarLinha(index, { processoNumero: e.target.value })}
                    />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-32">
                  <TooltipField value={linha.processoAutor}>
                    <Input
                      value={linha.processoAutor}
                      onChange={(e) => atualizarLinha(index, { processoAutor: e.target.value })}
                    />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-32">
                  <TooltipField value={linha.processoReu}>
                    <Input
                      value={linha.processoReu}
                      onChange={(e) => atualizarLinha(index, { processoReu: e.target.value })}
                    />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-56">
                  <div className="flex gap-1">
                    <Input
                      type="date" value={linha.dataAgendada ?? ''}
                      onChange={(e) => atualizarLinha(index, { dataAgendada: e.target.value || null })}
                    />
                    <Input
                      type="time" value={linha.horaAgendada ?? ''}
                      onChange={(e) => atualizarLinha(index, { horaAgendada: e.target.value || null })}
                    />
                  </div>
                </TableCell>
                <TableCell className="min-w-40">
                  <MunicipioCombobox
                    value={linha.municipioId}
                    selected={linha.municipioId ? { id: linha.municipioId, nome: linha.municipioNome, uf: linha.municipioUf } : null}
                    onChange={(m) =>
                      atualizarLinha(index, { municipioId: m.id, municipioNome: m.nome, municipioUf: m.uf })
                    }
                  />
                </TableCell>
                <TableCell className="min-w-36">
                  <TooltipField value={linha.peritoNome}>
                    <Input
                      value={linha.peritoNome}
                      onChange={(e) => atualizarLinha(index, { peritoNome: e.target.value, peritoIdExistente: null })}
                    />
                  </TooltipField>
                  <span
                    className={cn(
                      'mt-0.5 block text-xs text-muted-foreground',
                      !(!linha.peritoIdExistente && linha.peritoNome.trim()) && 'invisible'
                    )}
                  >
                    (novo)
                  </span>
                </TableCell>
                <TableCell className="min-w-36">
                  <TooltipField value={linha.colaboradorNome}>
                    <Input
                      value={linha.colaboradorNome}
                      placeholder="Nome1/Nome2"
                      onChange={(e) => atualizarLinha(index, { colaboradorNome: e.target.value, colaboradorIdsExistentes: [] })}
                    />
                  </TooltipField>
                  <span
                    className={cn(
                      'mt-0.5 block text-xs text-muted-foreground',
                      linha.colaboradorNome.split('/').map((n) => n.trim()).filter(Boolean).length
                        <= linha.colaboradorIdsExistentes.length && 'invisible'
                    )}
                  >
                    (novo)
                  </span>
                </TableCell>
                <TableCell className="min-w-28">
                  <Select
                    value={linha.situacao}
                    onValueChange={(v) => atualizarLinha(index, { situacao: v as PericiaInput['situacao'] })}
                  >
                    <SelectTrigger aria-label="Situação" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {situacaoOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="min-w-36">
                  <TooltipField value={linha.observacoes ?? ''}>
                    <Input
                      value={linha.observacoes ?? ''}
                      onChange={(e) => atualizarLinha(index, { observacoes: e.target.value || null })}
                    />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-28">
                  <TooltipField value={linha.processoEscritorio}>
                    <Input
                      value={linha.processoEscritorio}
                      onChange={(e) => atualizarLinha(index, { processoEscritorio: e.target.value })}
                    />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-28">
                  <TooltipField value={linha.contrato ?? ''}>
                    <Input
                      value={linha.contrato ?? ''}
                      onChange={(e) => atualizarLinha(index, { contrato: e.target.value || null })}
                    />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-40 max-w-56 whitespace-normal text-xs text-muted-foreground">
                  <TooltipField value={linha.motivos.join(' · ')}>
                    {linha.motivos.length > 0 ? (
                      <ul className="line-clamp-3 list-disc space-y-0.5 pl-3">
                        {linha.motivos.map((motivo, i) => (
                          <li key={i}>{motivo}</li>
                        ))}
                      </ul>
                    ) : (
                      <span>—</span>
                    )}
                  </TooltipField>
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => removerLinha(index)}>
                    <X className="size-4" />
                    <span className="sr-only">Remover linha {linha.linhaOriginal}</span>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {alturaDepois > 0 && (
            <tr aria-hidden style={{ height: alturaDepois }}>
              <td colSpan={NUMERO_COLUNAS} />
            </tr>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
