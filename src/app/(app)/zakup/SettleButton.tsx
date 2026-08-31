'use client';
import { useTransition } from 'react';
import { recordSettlement } from '@/lib/actions/purchases';
import { t } from '@/lib/strings';

/**
 * Отметить перевод может только получатель: деньги пришли ему, и подтвердить
 * это может он один. Иначе любой мог бы закрыть чужой долг, не заплатив.
 */
export function SettleButton({
  from, to, amount, canConfirm,
}: { from: string; to: string; amount: number; canConfirm: boolean }) {
  const [pending, start] = useTransition();
  if (!canConfirm) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-3"
        title={t.money.onlyPayee} aria-label={t.money.onlyPayee}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><circle cx="12" cy="16" r=".8" /></svg>
      </span>
    );
  }
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
