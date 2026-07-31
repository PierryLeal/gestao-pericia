'use client';

import { useState } from 'react';
import { requestPasswordReset } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function EsqueciSenhaForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await requestPasswordReset(email);
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return <p className="text-sm text-muted-foreground">Se esse e-mail existir, enviamos um link de recuperação.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Enviando...' : 'Enviar link de recuperação'}
      </Button>
    </form>
  );
}
