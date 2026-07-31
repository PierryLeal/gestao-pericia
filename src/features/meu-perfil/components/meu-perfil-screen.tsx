'use client';

import { useState, useTransition } from 'react';
import type { CurrentProfile } from '@/features/auth/guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateOwnNome, updateOwnPassword } from '../actions';

type FormMessage = { text: string; isError: boolean };

export function MeuPerfilScreen({ profile }: { profile: CurrentProfile }) {
  const [nome, setNome] = useState(profile.nome);
  const [nomePending, startNomeTransition] = useTransition();
  const [nomeMessage, setNomeMessage] = useState<FormMessage | null>(null);

  const [password, setPassword] = useState('');
  const [passwordPending, startPasswordTransition] = useTransition();
  const [passwordMessage, setPasswordMessage] = useState<FormMessage | null>(null);

  function handleNomeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNomeMessage(null);
    startNomeTransition(async () => {
      try {
        const result = await updateOwnNome(nome);
        setNomeMessage(
          result.success ? { text: 'Nome atualizado', isError: false } : { text: result.error, isError: true }
        );
      } catch {
        setNomeMessage({ text: 'Erro ao salvar nome', isError: true });
      }
    });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    startPasswordTransition(async () => {
      try {
        const result = await updateOwnPassword(password);
        setPasswordMessage(
          result.success ? { text: 'Senha atualizada', isError: false } : { text: result.error, isError: true }
        );
        if (result.success) setPassword('');
      } catch {
        setPasswordMessage({ text: 'Erro ao salvar senha', isError: true });
      }
    });
  }

  return (
    <div className="max-w-sm space-y-8">
      <h1 className="text-2xl font-semibold">Meu perfil</h1>
      <form onSubmit={handleNomeSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        {nomeMessage && (
          <p className={`text-sm ${nomeMessage.isError ? 'text-destructive' : ''}`}>{nomeMessage.text}</p>
        )}
        <Button type="submit" disabled={nomePending}>
          {nomePending ? 'Salvando...' : 'Salvar nome'}
        </Button>
      </form>
      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password" type="password" minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {passwordMessage && (
          <p className={`text-sm ${passwordMessage.isError ? 'text-destructive' : ''}`}>{passwordMessage.text}</p>
        )}
        <Button type="submit" disabled={passwordPending}>
          {passwordPending ? 'Salvando...' : 'Salvar senha'}
        </Button>
      </form>
    </div>
  );
}
