import { describe, it, expect } from 'vitest';
import { resolveRedirect } from './route-guard';

describe('resolveRedirect', () => {
  it('sends unauthenticated users to /login', () => {
    expect(resolveRedirect({ path: '/', isAuthenticated: false, role: null })).toBe('/login');
  });

  it('does not redirect unauthenticated users already on /login', () => {
    expect(resolveRedirect({ path: '/login', isAuthenticated: false, role: null })).toBeNull();
  });

  it('sends authenticated users away from /login', () => {
    expect(resolveRedirect({ path: '/login', isAuthenticated: true, role: 'admin' })).toBe('/');
  });

  it('sends pendente users to /pendente from any other page', () => {
    expect(resolveRedirect({ path: '/', isAuthenticated: true, role: 'pendente' })).toBe('/pendente');
  });

  it('does not redirect pendente users already on /pendente', () => {
    expect(resolveRedirect({ path: '/pendente', isAuthenticated: true, role: 'pendente' })).toBeNull();
  });

  it('sends non-pendente users away from /pendente', () => {
    expect(resolveRedirect({ path: '/pendente', isAuthenticated: true, role: 'gerencia' })).toBe('/');
  });

  it('blocks non-admin users from /perfis', () => {
    expect(resolveRedirect({ path: '/perfis', isAuthenticated: true, role: 'gerencia' })).toBe('/');
  });

  it('allows admin users on /perfis', () => {
    expect(resolveRedirect({ path: '/perfis', isAuthenticated: true, role: 'admin' })).toBeNull();
  });

  it('allows approved users on ordinary pages', () => {
    expect(resolveRedirect({ path: '/peritos', isAuthenticated: true, role: 'gerencia' })).toBeNull();
  });
});
