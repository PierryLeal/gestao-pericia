'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProcesso, type Processo } from '../actions';

export function NovoProcessoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (processo: Processo) => void;
}) {
  const [numero, setNumero] = useState('');
  const [autor, setAutor] = useState('');
  const [reu, setReu] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createProcesso({ numero, autor, reu });
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onCreated(result.data);
    setNumero('');
    setAutor('');
    setReu('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo processo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="numero">Número do processo</Label>
            <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="autor">Autor</Label>
            <Input id="autor" value={autor} onChange={(e) => setAutor(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reu">Réu</Label>
            <Input id="reu" value={reu} onChange={(e) => setReu(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar e vincular'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
