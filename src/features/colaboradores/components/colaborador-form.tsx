'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createColaborador, updateColaborador, type Colaborador } from '../actions';
import type { ColaboradorInput } from '../schemas';

export function ColaboradorForm({ colaborador }: { colaborador?: Colaborador }) {
  const router = useRouter();
  const [nome, setNome] = useState(colaborador?.nome ?? '');
  const [contato, setContato] = useState(colaborador?.contato ?? '');
  const [formacao, setFormacao] = useState(colaborador?.formacao ?? '');
  const [interno, setInterno] = useState(colaborador?.interno ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: ColaboradorInput = { nome, contato, formacao, interno };
    const result = colaborador
      ? await updateColaborador(colaborador.id, input)
      : await createColaborador(input);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push('/colaboradores');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
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
      <div className="flex items-center gap-2">
        <Switch id="interno" checked={interno} onCheckedChange={setInterno} />
        <Label htmlFor="interno">Colaborador interno</Label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar colaborador'}
      </Button>
    </form>
  );
}
