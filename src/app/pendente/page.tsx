import { signOut } from '@/features/auth/actions';
import { Button } from '@/components/ui/button';

export default function PendentePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold">Aguardando aprovação</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Seu acesso foi registrado, mas ainda precisa ser liberado por um administrador. Você será
        notificado assim que seu perfil for aprovado.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">Sair</Button>
      </form>
    </div>
  );
}
