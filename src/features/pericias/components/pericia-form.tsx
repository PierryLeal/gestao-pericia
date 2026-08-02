'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProcessoCombobox } from '@/features/processos/components/processo-combobox';
import { MunicipioCombobox } from '@/features/municipios/components/municipio-combobox';
import { createPericia, updatePericia, getColaboradoresIndisponiveis } from '../actions';
import { situacaoOptions, type PericiaInput } from '../schemas';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };

export function PericiaForm({
  pericia,
  peritos,
  colaboradores,
  onSaved,
  onError,
}: {
  pericia?: PericiaInput & { id: number; processo: Processo; municipio: MunicipioIBGE };
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
  onSaved: (id: number) => void;
  onError: (message: string) => void;
}) {
  const [processo, setProcesso] = useState<Processo | null>(pericia?.processo ?? null);
  const [municipio, setMunicipio] = useState<MunicipioIBGE | null>(pericia?.municipio ?? null);
  const [peritoId, setPeritoId] = useState(pericia?.peritoId ? String(pericia.peritoId) : '');
  const [colaboradorId, setColaboradorId] = useState(
    pericia?.colaboradorId ? String(pericia.colaboradorId) : ''
  );
  const [dataAgendada, setDataAgendada] = useState(pericia?.dataAgendada ?? '');
  const [horaAgendada, setHoraAgendada] = useState(pericia?.horaAgendada ?? '');
  const [situacao, setSituacao] = useState<PericiaInput['situacao']>(pericia?.situacao ?? 'pendente');
  const [saving, setSaving] = useState(false);
  const [busyColaboradorIds, setBusyColaboradorIds] = useState<number[]>([]);

  useEffect(() => {
    if (!dataAgendada || !horaAgendada) {
      setBusyColaboradorIds([]);
      return;
    }
    const handle = setTimeout(() => {
      getColaboradoresIndisponiveis(dataAgendada, horaAgendada, pericia?.id).then(setBusyColaboradorIds);
    }, 300);
    return () => clearTimeout(handle);
  }, [dataAgendada, horaAgendada, pericia?.id]);

  const colaboradorConflict = colaboradorId !== '' && busyColaboradorIds.includes(Number(colaboradorId));

  const peritoItems = Object.fromEntries(peritos.map((p) => [String(p.id), p.nome]));
  const colaboradorItems = Object.fromEntries(colaboradores.map((c) => [String(c.id), c.nome]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!processo || !municipio || !peritoId) {
      onError('Preencha processo, município e perito.');
      return;
    }
    if (colaboradorConflict) {
      onError('Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.');
      return;
    }
    setSaving(true);
    const input: PericiaInput = {
      processoId: processo.id,
      municipioId: municipio.id,
      peritoId: Number(peritoId),
      colaboradorId: colaboradorId ? Number(colaboradorId) : null,
      dataAgendada: dataAgendada || null,
      horaAgendada: horaAgendada || null,
      situacao,
    };
    const result = pericia ? await updatePericia(pericia.id, input) : await createPericia(input);
    setSaving(false);
    if (!result.success) {
      onError(result.error);
      return;
    }
    onSaved(result.data.id);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>Processo</Label>
        <ProcessoCombobox value={processo?.id ?? null} selected={processo} onChange={setProcesso} />
      </div>

      <div className="space-y-2">
        <Label>Município</Label>
        <MunicipioCombobox value={municipio?.id ?? null} selected={municipio} onChange={setMunicipio} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data">Data agendada</Label>
          <Input id="data" type="date" value={dataAgendada} onChange={(e) => setDataAgendada(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hora">Hora agendada</Label>
          <Input id="hora" type="time" value={horaAgendada} onChange={(e) => setHoraAgendada(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="perito">Perito</Label>
        <Select items={peritoItems} value={peritoId} onValueChange={(v) => setPeritoId(v ?? '')}>
          <SelectTrigger id="perito"><SelectValue placeholder="Selecione um perito" /></SelectTrigger>
          <SelectContent>
            {peritos.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="colaborador">Colaborador (opcional)</Label>
        <Select
          items={{ none: 'Nenhum', ...colaboradorItems }}
          value={colaboradorId || 'none'}
          onValueChange={(v) => setColaboradorId(!v || v === 'none' ? '' : v)}
        >
          <SelectTrigger id="colaborador"><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {colaboradores.map((c) => (
              <SelectItem
                key={c.id}
                value={String(c.id)}
                className={busyColaboradorIds.includes(c.id) ? 'opacity-40' : undefined}
              >
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {colaboradorConflict && (
          <p className="text-sm text-destructive">
            Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="situacao">Situação</Label>
        <Select value={situacao} onValueChange={(v) => setSituacao(v as PericiaInput['situacao'])}>
          <SelectTrigger id="situacao"><SelectValue /></SelectTrigger>
          <SelectContent>
            {situacaoOptions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={saving || colaboradorConflict} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : 'Salvar perícia'}
      </Button>
    </form>
  );
}
