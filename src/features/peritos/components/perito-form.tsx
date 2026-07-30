'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPhone, formatCPF } from '@/lib/masks';
import { createPerito, updatePerito, type Perito } from '../actions';
import { relacaoOptions, resultadoOptions, type PeritoInput } from '../schemas';

const RELACAO_LABELS: Record<(typeof relacaoOptions)[number], string> = {
  ruim: 'Ruim', neutra: 'Neutra', boa: 'Boa', otima: 'Ótima',
};
const RESULTADO_LABELS: Record<(typeof resultadoOptions)[number], string> = {
  negativo: 'Negativo', parcial: 'Parcial', positivo: 'Positivo',
};

export function PeritoForm({
  perito,
  onSaved,
  onError,
}: {
  perito?: Perito;
  onSaved: (perito: Perito) => void;
  onError: (message: string) => void;
}) {
  const [nome, setNome] = useState(perito?.nome ?? '');
  const [contato, setContato] = useState(
    (perito?.contato ?? '').replace(/\D/g, '').length <= 11
      ? formatPhone(perito?.contato ?? '')
      : (perito?.contato ?? '')
  );
  const [formacao, setFormacao] = useState(perito?.formacao ?? '');
  const [crea, setCrea] = useState(perito?.crea ?? '');
  const [documento, setDocumento] = useState(
    (perito?.documento ?? '').replace(/\D/g, '').length <= 11
      ? formatCPF(perito?.documento ?? '')
      : (perito?.documento ?? '')
  );
  const [jaTrabalhamos, setJaTrabalhamos] = useState(perito?.jaTrabalhamos ?? false);
  const [relacao, setRelacao] = useState<PeritoInput['relacao']>(perito?.relacao ?? 'neutra');
  const [resultados, setResultados] = useState<PeritoInput['resultados']>(perito?.resultados ?? 'parcial');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input: PeritoInput = { nome, contato, formacao, crea, documento, jaTrabalhamos, relacao, resultados };
    const result = perito ? await updatePerito(perito.id, input) : await createPerito(input);
    setSaving(false);
    if (!result.success) {
      onError(result.error);
      return;
    }
    onSaved(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contato">Contato</Label>
        <Input
          id="contato" value={contato} onChange={(e) => setContato(formatPhone(e.target.value))}
          placeholder="(99) 99999-9999"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="formacao">Formação</Label>
        <Input id="formacao" value={formacao} onChange={(e) => setFormacao(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="crea">CREA</Label>
          <Input id="crea" value={crea} onChange={(e) => setCrea(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="documento">Documento</Label>
          <Input
            id="documento" value={documento} onChange={(e) => setDocumento(formatCPF(e.target.value))}
            placeholder="999.999.999-99"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="ja-trabalhamos" checked={jaTrabalhamos} onCheckedChange={setJaTrabalhamos} />
        <Label htmlFor="ja-trabalhamos">Já trabalhamos com este perito</Label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="relacao">Relação</Label>
          <Select value={relacao} onValueChange={(v) => setRelacao(v as PeritoInput['relacao'])}>
            <SelectTrigger id="relacao">
              {relacao ? RELACAO_LABELS[relacao] : 'Selecione...'}
            </SelectTrigger>
            <SelectContent>
              {relacaoOptions.map((r) => (
                <SelectItem key={r} value={r}>{RELACAO_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="resultados">Resultado</Label>
          <Select value={resultados} onValueChange={(v) => setResultados(v as PeritoInput['resultados'])}>
            <SelectTrigger id="resultados">
              {resultados ? RESULTADO_LABELS[resultados] : 'Selecione...'}
            </SelectTrigger>
            <SelectContent>
              {resultadoOptions.map((r) => (
                <SelectItem key={r} value={r}>{RESULTADO_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : 'Salvar perito'}
      </Button>
    </form>
  );
}
