'use client';

import { X } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MunicipioCombobox } from '@/features/municipios/components/municipio-combobox';
import { TooltipField } from '@/components/shared/tooltip-field';
import { situacaoOptions, type PericiaInput } from '../../pericias/schemas';
import { cn } from '@/lib/utils';
import type { PericiaPreviewRow } from '../types';

export function PericiasPreviewTable({
  linhas,
  onChange,
}: {
  linhas: PericiaPreviewRow[];
  onChange: (linhas: PericiaPreviewRow[]) => void;
}) {
  function atualizarLinha(index: number, patch: Partial<PericiaPreviewRow>) {
    onChange(linhas.map((linha, i) => (i === index ? { ...linha, ...patch } : linha)));
  }

  function removerLinha(index: number) {
    onChange(linhas.filter((_, i) => i !== index));
  }

  return (
    <Table>
      <TableHeader>
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
          <TableHead>Motivo</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((linha, index) => (
          <TableRow
            key={linha.linhaOriginal}
            className={cn(
              linha.status === 'atencao' && 'bg-destructive/10',
              linha.status === 'suspeito' && 'bg-amber-500/10',
              linha.status === 'duplicada' && 'opacity-50'
            )}
          >
            <TableCell className="min-w-40">
              <TooltipField value={linha.processoNumero}>
                <Input
                  value={linha.processoNumero}
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
              {!linha.peritoIdExistente && linha.peritoNome.trim() && (
                <span className="mt-0.5 block text-xs text-muted-foreground">(novo)</span>
              )}
            </TableCell>
            <TableCell className="min-w-36">
              <TooltipField value={linha.colaboradorNome}>
                <Input
                  value={linha.colaboradorNome}
                  placeholder="Nome1/Nome2"
                  onChange={(e) => atualizarLinha(index, { colaboradorNome: e.target.value, colaboradorIdsExistentes: [] })}
                />
              </TooltipField>
              {linha.colaboradorNome.split('/').map((n) => n.trim()).filter(Boolean).length
                > linha.colaboradorIdsExistentes.length && (
                <span className="mt-0.5 block text-xs text-muted-foreground">(novo)</span>
              )}
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
            <TableCell className="min-w-40 max-w-56 whitespace-normal text-xs text-muted-foreground">
              <TooltipField value={linha.motivo ?? ''}>
                <span className="line-clamp-2">{linha.motivo ?? '—'}</span>
              </TooltipField>
            </TableCell>
            <TableCell>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => removerLinha(index)}>
                <X className="size-4" />
                <span className="sr-only">Remover linha {linha.linhaOriginal}</span>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
