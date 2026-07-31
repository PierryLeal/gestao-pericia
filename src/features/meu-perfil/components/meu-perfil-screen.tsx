'use client';

import { useState, useTransition } from 'react';
import type { CurrentProfile } from '@/features/auth/guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateOwnNome, updateOwnPassword } from '../actions';

export function MeuPerfilScreen({ profile }: { profile: CurrentProfile }) {
  const [nome, setNome] = useState(profile.nome);
  const [nomePending, startNomeTransition] = useTransition();
  const [nomeMessage, setNomeMessage] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [passwordPending, startPasswordTransition] = useTransition();
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  function handleNomeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNomeMessage(null);
    startNomeTransition(async () => {
      const result = await updateOwnNome(nome);
      setNomeMessage(result.success ? 'Nome atualizado' : result.error);
    });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    startPasswordTransition(async () => {
      const result = await updateOwnPassword(password);
      setPasswordMessage(result.success ? 'Senha atualizada' : result.error);
      if (result.success) setPassword('');
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
        {nomeMessage && <p className="text-sm">{nomeMessage}</p>}
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
        {passwordMessage && <p className="text-sm">{passwordMessage}</p>}
        <Button type="submit" disabled={passwordPending}>
          {passwordPending ? 'Salvando...' : 'Salvar senha'}
        </Button>
      </form>
    </div>
  );
}
