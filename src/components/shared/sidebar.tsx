'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Role } from '@/features/auth/guards';
import { signOut } from '@/features/auth/actions';
import { Button } from '@/components/ui/button';

const NAV_ITEMS: { href: string; label: string; roles: Role[] }[] = [
  { href: '/', label: 'Perícias', roles: ['admin', 'gerencia'] },
  { href: '/peritos', label: 'Peritos', roles: ['admin', 'gerencia'] },
  { href: '/colaboradores', label: 'Colaboradores', roles: ['admin', 'gerencia'] },
  { href: '/perfis', label: 'Perfis', roles: ['admin'] },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="flex h-full w-56 flex-col gap-1 border-r bg-muted/30 p-4">
      <span className="mb-4 px-2 text-lg font-semibold">Gestão de Perícias</span>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-medium hover:bg-muted',
            pathname === item.href && 'bg-muted text-foreground'
          )}
        >
          {item.label}
        </Link>
      ))}
      <form action={signOut} className="mt-auto">
        <Button type="submit" variant="ghost" className="w-full justify-start">
          Sair
        </Button>
      </form>
    </nav>
  );
}
