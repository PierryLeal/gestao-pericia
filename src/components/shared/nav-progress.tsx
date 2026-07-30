'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useLinkStatus } from 'next/link';

const pendingLinks = new Set<symbol>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return pendingLinks.size > 0;
}

function getServerSnapshot() {
  return false;
}

export function NavProgressReporter() {
  const { pending } = useLinkStatus();

  useEffect(() => {
    if (!pending) return;
    const key = Symbol('nav-pending');
    pendingLinks.add(key);
    notify();
    return () => {
      pendingLinks.delete(key);
      notify();
    };
  }, [pending]);

  return null;
}

export function NavProgressBar() {
  const isPending = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-primary/15 transition-opacity duration-200 ${
        isPending ? 'opacity-100 delay-150' : 'opacity-0'
      }`}
    >
      {isPending && <div className="h-full w-1/3 animate-nav-progress bg-primary" />}
    </div>
  );
}
