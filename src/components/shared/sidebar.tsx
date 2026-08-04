'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList, CalendarDays, Folder, UserCheck, Users, ShieldCheck, UserCog,
  PanelLeftClose, PanelLeftOpen, LogOut, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role } from '@/features/auth/guards';
import { signOut } from '@/features/auth/actions';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { NavProgressReporter } from '@/components/shared/nav-progress';

export const NAV_ITEMS: { href: string; label: string; roles: Role[]; icon: LucideIcon }[] = [
  { href: '/', label: 'Perícias', roles: ['admin', 'gerencia'], icon: ClipboardList },
  { href: '/calendario', label: 'Calendário', roles: ['admin', 'gerencia'], icon: CalendarDays },
  { href: '/processos', label: 'Processos', roles: ['admin', 'gerencia'], icon: Folder },
  { href: '/peritos', label: 'Peritos', roles: ['admin', 'gerencia'], icon: UserCheck },
  { href: '/colaboradores', label: 'Colaboradores', roles: ['admin', 'gerencia'], icon: Users },
  { href: '/perfis', label: 'Perfis', roles: ['admin'], icon: ShieldCheck },
  { href: '/meu-perfil', label: 'Meu perfil', roles: ['admin', 'gerencia'], icon: UserCog },
];

const STORAGE_KEY = 'sidebar-collapsed';

function NavLink({
  href, label, Icon, active, collapsed,
}: {
  href: string; label: string; Icon: LucideIcon; active: boolean; collapsed: boolean;
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent',
        collapsed && 'size-9 justify-center rounded-full px-0 py-0',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground'
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
      <NavProgressReporter />
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={<div />}>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a client-only UI preference from localStorage on mount; there is no SSR-safe way to know this before hydration, and a lazy useState initializer would cause a hydration mismatch instead.
    if (localStorage.getItem(STORAGE_KEY) === 'true') setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <nav
      className={cn(
        'flex h-full flex-col gap-1 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground transition-all duration-200',
        collapsed ? 'w-16 items-center' : 'w-56'
      )}
    >
      <div className={cn('mb-4 flex items-center gap-2 px-2', collapsed && 'justify-center px-0')}>
        <img src="/logo-mark.png" alt="" className="size-8 shrink-0" />
        {!collapsed && (
          <span className="font-heading text-lg font-semibold">Gestão de Perícias</span>
        )}
      </div>
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          Icon={item.icon}
          active={pathname === item.href}
          collapsed={collapsed}
        />
      ))}
      <div className={cn('mt-auto flex flex-col gap-1 pt-4', collapsed && 'items-center')}>
        <form action={signOut} className="w-full">
          <Button
            type="submit"
            variant="ghost"
            aria-label={collapsed ? 'Sair' : undefined}
            className={cn('w-full justify-start gap-2', collapsed && 'size-9 justify-center rounded-full px-0')}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && 'Sair'}
          </Button>
        </form>
        <Button
          type="button"
          variant="ghost"
          aria-label={collapsed ? 'Expandir menu' : undefined}
          className={cn('w-full justify-start gap-2', collapsed && 'size-9 justify-center rounded-full px-0')}
          onClick={toggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
          {!collapsed && 'Recolher'}
        </Button>
      </div>
    </nav>
  );
}
