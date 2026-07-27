import type { Role } from './guards';

export type RouteGuardInput = {
  path: string;
  isAuthenticated: boolean;
  role: Role | null;
};

const PUBLIC_PATHS = ['/login', '/auth/callback'];

export function resolveRedirect({ path, isAuthenticated, role }: RouteGuardInput): string | null {
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!isAuthenticated) {
    return isPublic ? null : '/login';
  }
  if (path === '/login') return '/';
  if (role === 'pendente') {
    return path === '/pendente' ? null : '/pendente';
  }
  if (path === '/pendente') return '/';
  if (path.startsWith('/perfis') && role !== 'admin') return '/';
  return null;
}
