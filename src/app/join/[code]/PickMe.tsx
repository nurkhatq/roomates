'use client';
import { useTransition } from 'react';
import { joinAs } from '@/lib/actions/auth';

export function PickMe({ id, children }: { id: string; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => { void joinAs(id); })}
      disabled={pending}
      className="flex min-h-14 w-full items-center gap-3 border-b border-line text-left last:border-b-0 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
