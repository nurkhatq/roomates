'use client';
import Link from 'next/link';
import { useState } from 'react';

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
      <Link href="/dom" className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{houseName}</div>
        <div className="text-[12px] text-ink-3">{me}</div>
      </Link>
      <button onClick={share} className="min-h-11 rounded-lg border border-line px-3 text-[12px] font-medium text-ink-2">
        {copied ? 'Ссылка скопирована' : <span className="num">{code}</span>}
      </button>
    </header>
  );
}
