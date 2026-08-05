'use client';

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MunicipioCombobox } from '@/features/municipios/components/municipio-combobox';
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Processo</TableHead>
          <TableHead>Data - Hora</TableHead>
          <TableHead>Local</TableHead>
          <TableHead>Perito</TableHead>
          <TableHead>Colaborador</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead>Obs.</TableHead>
          <TableHead>Escritório</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((linha, index) => (
          <TableRow
            key={linha.linhaOriginal}
            className={cn(
              linha.status === 'atencao' && 'bg-destructive/10',
              linha.status === 'duplicada' && 'opacity-50'
            )}
          >
            <TableCell>
              <Input
                value={linha.processoNumero}
                onChange={(e) => atualizarLinha(index, { processoNumero: e.target.value })}
              />
            </TableCell>
            <TableCell>
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
            <TableCell>
              <MunicipioCombobox
                value={linha.municipioId}
                selected={linha.municipioId ? { id: linha.municipioId, nome: linha.municipioNome, uf: linha.municipioUf } : null}
                onChange={(m) =>
                  atualizarLinha(index, { municipioId: m.id, municipioNome: m.nome, municipioUf: m.uf })
                }
              />
            </TableCell>
            <TableCell>
              <Input
                value={linha.peritoNome}
                onChange={(e) => atualizarLinha(index, { peritoNome: e.target.value, peritoIdExistente: null })}
              />
              {!linha.peritoIdExistente && linha.peritoNome.trim() && (
                <span className="ml-1 text-xs text-muted-foreground">(novo)</span>
              )}
            </TableCell>
            <TableCell>
              <Input
                value={linha.colaboradorNome}
                onChange={(e) => atualizarLinha(index, { colaboradorNome: e.target.value, colaboradorIdExistente: null })}
              />
              {!linha.colaboradorIdExistente && linha.colaboradorNome.trim() && (
                <span className="ml-1 text-xs text-muted-foreground">(novo)</span>
              )}
            </TableCell>
            <TableCell>
              <Select
                value={linha.situacao}
                onValueChange={(v) => atualizarLinha(index, { situacao: v as PericiaInput['situacao'] })}
              >
                <SelectTrigger aria-label="Situação"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {situacaoOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Input
                value={linha.observacoes ?? ''}
                onChange={(e) => atualizarLinha(index, { observacoes: e.target.value || null })}
              />
            </TableCell>
            <TableCell>
              <Input
                value={linha.processoEscritorio}
                onChange={(e) => atualizarLinha(index, { processoEscritorio: e.target.value })}
              />
            </TableCell>
            {linha.motivo && (
              <TableCell className="text-xs text-muted-foreground">{linha.motivo}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
