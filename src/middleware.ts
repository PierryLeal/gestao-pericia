import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { resolveRedirect } from '@/features/auth/route-guard';

export async function middleware(request: NextRequest) {
  const { response, user, role } = await updateSession(request);

  const target = resolveRedirect({
    path: request.nextUrl.pathname,
    isAuthenticated: Boolean(user),
    role,
  });

  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
