'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProcesso, updateProcesso, type Processo } from '../actions';

export function ProcessoForm({
  processo,
  onSaved,
  onError,
  submitLabel = 'Salvar processo',
}: {
  processo?: Processo;
  onSaved: (processo: Processo) => void;
  onError: (message: string) => void;
  submitLabel?: string;
}) {
  const [numero, setNumero] = useState(processo?.numero ?? '');
  const [autor, setAutor] = useState(processo?.autor ?? '');
  const [reu, setReu] = useState(processo?.reu ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input = { numero, autor, reu };
    const result = processo ? await updateProcesso(processo.id, input) : await createProcesso(input);
    setSaving(false);
    if (!result.success) {
      onError(result.error);
      return;
    }
    onSaved(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="numero">Número do processo</Label>
        <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="autor">Autor</Label>
        <Input id="autor" value={autor} onChange={(e) => setAutor(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reu">Réu</Label>
        <Input id="reu" value={reu} onChange={(e) => setReu(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : submitLabel}
      </Button>
    </form>
  );
}
