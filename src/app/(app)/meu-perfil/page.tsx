import { getCurrentProfile } from '@/features/auth/guards';
import { MeuPerfilScreen } from '@/features/meu-perfil/components/meu-perfil-screen';

export default async function MeuPerfilPage() {
  const profile = await getCurrentProfile();
  return <MeuPerfilScreen profile={profile!} />;
}
