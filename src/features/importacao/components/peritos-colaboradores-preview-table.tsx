'use client';

import { X } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipField } from '@/components/shared/tooltip-field';
import { relacaoOptions, resultadoOptions, type PeritoInput } from '../../peritos/schemas';
import { cn } from '@/lib/utils';
import type { ColaboradorPreviewRow, PeritoPreviewRow } from '../types';

export function PeritosColaboradoresPreviewTable({
  colaboradores,
  peritos,
  onChangeColaboradores,
  onChangePeritos,
}: {
  colaboradores: ColaboradorPreviewRow[];
  peritos: PeritoPreviewRow[];
  onChangeColaboradores: (linhas: ColaboradorPreviewRow[]) => void;
  onChangePeritos: (linhas: PeritoPreviewRow[]) => void;
}) {
  function atualizarColaborador(index: number, patch: Partial<ColaboradorPreviewRow>) {
    onChangeColaboradores(colaboradores.map((linha, i) => (i === index ? { ...linha, ...patch } : linha)));
  }
  function atualizarPerito(index: number, patch: Partial<PeritoPreviewRow>) {
    onChangePeritos(peritos.map((linha, i) => (i === index ? { ...linha, ...patch } : linha)));
  }
  function removerColaborador(index: number) {
    onChangeColaboradores(colaboradores.filter((_, i) => i !== index));
  }
  function removerPerito(index: number) {
    onChangePeritos(peritos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Colaboradores</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {colaboradores.map((linha, index) => (
              <TableRow key={linha.linhaOriginal} className={cn(linha.status === 'atencao' && 'bg-destructive/10')}>
                <TableCell className="min-w-40">
                  <TooltipField value={linha.nome}>
                    <Input value={linha.nome} onChange={(e) => atualizarColaborador(index, { nome: e.target.value })} />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-32">
                  <TooltipField value={linha.contato}>
                    <Input value={linha.contato} onChange={(e) => atualizarColaborador(index, { contato: e.target.value })} />
                  </TooltipField>
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => removerColaborador(index)}>
                    <X className="size-4" />
                    <span className="sr-only">Remover linha {linha.linhaOriginal}</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Peritos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Formação</TableHead>
              <TableHead>CREA</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Já trabalhamos?</TableHead>
              <TableHead>Relação</TableHead>
              <TableHead>Resultados</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {peritos.map((linha, index) => (
              <TableRow key={linha.linhaOriginal} className={cn(linha.status === 'atencao' && 'bg-destructive/10')}>
                <TableCell className="min-w-40">
                  <TooltipField value={linha.nome}>
                    <Input value={linha.nome} onChange={(e) => atualizarPerito(index, { nome: e.target.value })} />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-32">
                  <TooltipField value={linha.contato}>
                    <Input value={linha.contato} onChange={(e) => atualizarPerito(index, { contato: e.target.value })} />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-36">
                  <TooltipField value={linha.formacao}>
                    <Input value={linha.formacao} onChange={(e) => atualizarPerito(index, { formacao: e.target.value })} />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-24">
                  <TooltipField value={linha.crea}>
                    <Input value={linha.crea} onChange={(e) => atualizarPerito(index, { crea: e.target.value })} />
                  </TooltipField>
                </TableCell>
                <TableCell className="min-w-32">
                  <TooltipField value={linha.documento}>
                    <Input value={linha.documento} onChange={(e) => atualizarPerito(index, { documento: e.target.value })} />
                  </TooltipField>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={linha.jaTrabalhamos}
                    onCheckedChange={(checked) => atualizarPerito(index, { jaTrabalhamos: checked })}
                  />
                </TableCell>
                <TableCell className="min-w-28">
                  <Select
                    value={linha.relacao}
                    onValueChange={(v) => atualizarPerito(index, { relacao: v as PeritoInput['relacao'] })}
                  >
                    <SelectTrigger aria-label="Relação" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {relacaoOptions.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="min-w-28">
                  <Select
                    value={linha.resultados}
                    onValueChange={(v) => atualizarPerito(index, { resultados: v as PeritoInput['resultados'] })}
                  >
                    <SelectTrigger aria-label="Resultados" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {resultadoOptions.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="min-w-40 max-w-56 whitespace-normal text-xs text-muted-foreground">
                  <TooltipField value={linha.motivo ?? ''}>
                    <span className="line-clamp-2">{linha.motivo ?? '—'}</span>
                  </TooltipField>
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => removerPerito(index)}>
                    <X className="size-4" />
                    <span className="sr-only">Remover linha {linha.linhaOriginal}</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
