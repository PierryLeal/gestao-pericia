'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createPerito, updatePerito, type Perito } from '../actions';
import type { PeritoInput } from '../schemas';

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
  const [contato, setContato] = useState(perito?.contato ?? '');
  const [formacao, setFormacao] = useState(perito?.formacao ?? '');
  const [crea, setCrea] = useState(perito?.crea ?? '');
  const [documento, setDocumento] = useState(perito?.documento ?? '');
  const [jaTrabalhamos, setJaTrabalhamos] = useState(perito?.jaTrabalhamos ?? false);
  const [relacao, setRelacao] = useState(perito?.relacao ?? 0);
  const [resultados, setResultados] = useState(perito?.resultados ?? 0);
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
        <Input id="contato" value={contato} onChange={(e) => setContato(e.target.value)} />
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
          <Input id="documento" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="ja-trabalhamos" checked={jaTrabalhamos} onCheckedChange={setJaTrabalhamos} />
        <Label htmlFor="ja-trabalhamos">Já trabalhamos com este perito</Label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="relacao">Relação (0 a 10)</Label>
          <Input
            id="relacao" type="number" min={0} max={10} value={relacao}
            onChange={(e) => setRelacao(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="resultados">Resultados (0 a 10)</Label>
          <Input
            id="resultados" type="number" min={0} max={10} value={resultados}
            onChange={(e) => setResultados(Number(e.target.value))}
          />
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : 'Salvar perito'}
      </Button>
    </form>
  );
}
