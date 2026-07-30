'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatPhone } from '@/lib/masks';
import { createColaborador, updateColaborador, type Colaborador } from '../actions';
import type { ColaboradorInput } from '../schemas';

export function ColaboradorForm({
  colaborador,
  onSaved,
  onError,
}: {
  colaborador?: Colaborador;
  onSaved: (colaborador: Colaborador) => void;
  onError: (message: string) => void;
}) {
  const [nome, setNome] = useState(colaborador?.nome ?? '');
  const [contato, setContato] = useState(
    (colaborador?.contato ?? '').replace(/\D/g, '').length <= 11
      ? formatPhone(colaborador?.contato ?? '')
      : (colaborador?.contato ?? '')
  );
  const [formacao, setFormacao] = useState(colaborador?.formacao ?? '');
  const [interno, setInterno] = useState(colaborador?.interno ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input: ColaboradorInput = { nome, contato, formacao, interno };
    const result = colaborador
      ? await updateColaborador(colaborador.id, input)
      : await createColaborador(input);
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
      <div className="flex items-center gap-2">
        <Switch id="interno" checked={interno} onCheckedChange={setInterno} />
        <Label htmlFor="interno">Colaborador interno</Label>
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : 'Salvar colaborador'}
      </Button>
    </form>
  );
}
