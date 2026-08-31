'use client';
import { useState } from 'react';
import { leaveSession } from '@/lib/actions/auth';
import { t } from '@/lib/strings';

export function HouseHeader({ houseName, code, me }: { houseName: string; code: string; me: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${location.origin}/join/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: houseName, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* пользователь закрыл окно — это не ошибка */ }
  };

  return (
    <header className="sticky top-0 z-30 -mx-3.5 mb-3 flex items-center gap-3 border-b border-line bg-paper px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{houseName}</div>
        <div className="text-[12px] text-ink-3">{me}</div>
      </div>
      <button onClick={share} className="min-h-11 rounded-lg border border-line px-3 text-[12px] font-medium text-ink-2">
        {copied ? 'Ссылка скопирована' : <span className="num">{code}</span>}
      </button>
      <form action={leaveSession}>
        <button className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-3" aria-label={t.common.leave}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
          </svg>
        </button>
      </form>
    </header>
  );
}
