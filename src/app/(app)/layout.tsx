import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/features/auth/guards';
import { Sidebar } from '@/components/shared/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { NavProgressBar } from '@/components/shared/nav-progress';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role === 'pendente') redirect('/pendente');

  return (
    <div className="flex h-screen">
      <NavProgressBar />
      <Sidebar role={profile.role} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
      <Toaster />
    </div>
  );
}
