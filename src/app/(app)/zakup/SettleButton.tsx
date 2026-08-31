'use client';
import { useTransition } from 'react';
import { recordSettlement } from '@/lib/actions/purchases';
import { t } from '@/lib/strings';

export function SettleButton({ from, to, amount }: { from: string; to: string; amount: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => { void recordSettlement(from, to, amount); })}
      disabled={pending}
      title={t.money.markSettled}
      aria-label={t.money.markSettled}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink-2 disabled:opacity-40"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
    </button>
  );
}
