'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ProcessoCombobox } from '@/features/processos/components/processo-combobox';
import { MunicipioCombobox } from '@/features/municipios/components/municipio-combobox';
import { ContratoCombobox } from './contrato-combobox';
import { createPericia, updatePericia, getColaboradoresIndisponiveis, type EditingPericia } from '../actions';
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
  pericia?: EditingPericia;
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
  onSaved: (id: number) => void;
  onError: (message: string) => void;
}) {
  const [processo, setProcesso] = useState<Processo | null>(pericia?.processo ?? null);
  const [municipio, setMunicipio] = useState<MunicipioIBGE | null>(pericia?.municipio ?? null);
  const [peritoId, setPeritoId] = useState(pericia?.peritoId ? String(pericia.peritoId) : '');
  // One slot per colaborador select; a slot can be '' (not yet chosen). Always
  // at least one slot so the row (and its "+") is there even with none picked.
  const [colaboradorIds, setColaboradorIds] = useState<string[]>(
    pericia && pericia.colaboradorIds.length > 0 ? pericia.colaboradorIds.map(String) : ['']
  );
  const [dataAgendada, setDataAgendada] = useState(pericia?.dataAgendada ?? '');
  const [horaAgendada, setHoraAgendada] = useState(pericia?.horaAgendada ?? '');
  const [situacao, setSituacao] = useState<PericiaInput['situacao']>(pericia?.situacao ?? 'pendente');
  const [observacoes, setObservacoes] = useState(pericia?.observacoes ?? '');
  const [contrato, setContrato] = useState<string | null>(pericia?.contrato ?? null);
  const [saving, setSaving] = useState(false);
  const [busyColaboradorIds, setBusyColaboradorIds] = useState<number[]>([]);

  useEffect(() => {
    if (!dataAgendada || !horaAgendada) {
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      getColaboradoresIndisponiveis(
        dataAgendada, horaAgendada, processo?.id, pericia?.id,
        peritoId ? Number(peritoId) : undefined, municipio?.nome, situacao
      )
        .then((ids) => {
          if (!cancelled) setBusyColaboradorIds(ids);
        })
        .catch(() => {
          if (!cancelled) onError('Não foi possível verificar conflitos de horário.');
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [dataAgendada, horaAgendada, processo?.id, pericia?.id, peritoId, municipio?.nome, situacao]);

  const effectiveBusyIds = dataAgendada && horaAgendada ? busyColaboradorIds : [];
  const colaboradorSelecionados = colaboradorIds.filter((id) => id !== '');
  const colaboradorConflitante = colaboradores.find(
    (c) => colaboradorSelecionados.includes(String(c.id)) && effectiveBusyIds.includes(c.id)
  );

  const peritoItems = Object.fromEntries(peritos.map((p) => [String(p.id), p.nome]));

  function handleAlterarColaborador(index: number, value: string) {
    setColaboradorIds((atual) => atual.map((id, i) => (i === index ? value : id)));
  }

  function handleAdicionarColaborador() {
    setColaboradorIds((atual) => [...atual, '']);
  }

  function handleRemoverColaborador(index: number) {
    setColaboradorIds((atual) => atual.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!processo || !municipio || !peritoId) {
      onError('Preencha processo, município e perito.');
      return;
    }
    if (colaboradorConflitante) {
      onError('Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.');
      return;
    }
    setSaving(true);
    const input: PericiaInput = {
      processoId: processo.id,
      municipioId: municipio.id,
      peritoId: Number(peritoId),
      colaboradorIds: colaboradorSelecionados.map(Number),
      dataAgendada: dataAgendada || null,
      horaAgendada: horaAgendada || null,
      situacao,
      observacoes: observacoes.trim() || null,
      contrato,
      local: municipio.nome,
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

      <div className="space-y-2">
        <Label>Contrato</Label>
        <ContratoCombobox value={contrato} onChange={setContrato} />
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
          <SelectTrigger id="perito" className="w-full"><SelectValue placeholder="Selecione um perito" /></SelectTrigger>
          <SelectContent>
            {peritos.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Colaborador (opcional)</Label>
        <div className="space-y-2">
          {colaboradorIds.map((valorSelecionado, index) => {
            const ultimaLinha = index === colaboradorIds.length - 1;
            // A colaborador already chosen in another row isn't offered again here.
            const opcoesDisponiveis = colaboradores.filter(
              (c) => String(c.id) === valorSelecionado || !colaboradorIds.includes(String(c.id))
            );
            return (
              <div key={index} className="flex items-center gap-2">
                <Select
                  items={{ none: 'Nenhum', ...Object.fromEntries(opcoesDisponiveis.map((c) => [String(c.id), c.nome])) }}
                  value={valorSelecionado || 'none'}
                  onValueChange={(v) => handleAlterarColaborador(index, !v || v === 'none' ? '' : v)}
                >
                  <SelectTrigger aria-label={`Colaborador ${index + 1}`} className="flex-1">
                    <SelectValue placeholder="Selecione um colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {opcoesDisponiveis.map((c) => (
                      <SelectItem
                        key={c.id}
                        value={String(c.id)}
                        className={effectiveBusyIds.includes(c.id) ? 'opacity-40' : undefined}
                      >
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ultimaLinha ? (
                  <Button type="button" variant="outline" size="icon" onClick={handleAdicionarColaborador}>
                    <Plus className="size-4" />
                    <span className="sr-only">Adicionar outro colaborador</span>
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="icon" onClick={() => handleRemoverColaborador(index)}>
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remover colaborador {index + 1}</span>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {colaboradorConflitante && (
          <p className="text-sm text-destructive">
            {colaboradorConflitante.nome} já está atribuído a outra perícia nesse mesmo dia e horário.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="situacao">Situação</Label>
        <Select value={situacao} onValueChange={(v) => setSituacao(v as PericiaInput['situacao'])}>
          <SelectTrigger id="situacao" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {situacaoOptions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
      </div>

      <Button type="submit" disabled={saving || Boolean(colaboradorConflitante)} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : 'Salvar perícia'}
      </Button>
    </form>
  );
}
