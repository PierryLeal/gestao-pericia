'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { situacaoOptions, type PericiaInput } from '../schemas';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };

export type CalendarioFiltersValue = {
  situacao?: PericiaInput['situacao'];
  busca?: string;
  peritoId?: number;
  colaboradorId?: number;
};

export function CalendarioFilters({
  peritos,
  colaboradores,
  onChange,
}: {
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
  onChange: (value: CalendarioFiltersValue) => void;
}) {
  const [value, setValue] = useState<CalendarioFiltersValue>({});

  function update(patch: Partial<CalendarioFiltersValue>) {
    const next = { ...value, ...patch };
    setValue(next);
    onChange(next);
  }

  return (
    <Card size="sm">
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="calendario-busca">Processo</Label>
          <Input
            id="calendario-busca"
            value={value.busca ?? ''}
            onChange={(e) => update({ busca: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calendario-situacao">Situação</Label>
          <Select
            value={value.situacao ?? 'todas'}
            onValueChange={(v) => update({ situacao: v === 'todas' ? undefined : (v as PericiaInput['situacao']) })}
          >
            <SelectTrigger id="calendario-situacao" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {situacaoOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calendario-perito">Perito</Label>
          <Select
            items={{ todos: 'Todos', ...Object.fromEntries(peritos.map((p) => [String(p.id), p.nome])) }}
            value={value.peritoId ? String(value.peritoId) : 'todos'}
            onValueChange={(v) => update({ peritoId: !v || v === 'todos' ? undefined : Number(v) })}
          >
            <SelectTrigger id="calendario-perito" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {peritos.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calendario-colaborador">Colaborador</Label>
          <Select
            items={{ todos: 'Todos', ...Object.fromEntries(colaboradores.map((c) => [String(c.id), c.nome])) }}
            value={value.colaboradorId ? String(value.colaboradorId) : 'todos'}
            onValueChange={(v) => update({ colaboradorId: !v || v === 'todos' ? undefined : Number(v) })}
          >
            <SelectTrigger id="calendario-colaborador" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {colaboradores.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
