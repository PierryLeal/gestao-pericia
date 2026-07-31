'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signInWithPassword, type AuthActionState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    signInWithPassword,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      <Link href="/esqueci-senha" className="block text-right text-sm text-muted-foreground hover:underline">
        Esqueci minha senha
      </Link>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Entrando...' : 'Entrar'}
      </Button>
    </form>
  );
}
