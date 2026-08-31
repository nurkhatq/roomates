'use client';
import { useState, useTransition } from 'react';
import { joinAs } from '@/lib/actions/auth';
import { btnPrimary, btnGhost, inputCls } from '@/components/ui';
import { t } from '@/lib/strings';

/**
 * Выбор себя в списке жильцов. У кого пароль поставлен — сначала спросим его;
 * у кого ещё нет — пускаем как раньше, а внутри система попросит завести.
 */
export function PickMe({
  id, hasPassword, children,
}: { id: string; hasPassword: boolean; children: React.ReactNode }) {
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const enter = () => start(async () => {
    const res = await joinAs(id, password);
    setError(res?.error ?? '');
  });

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        onClick={() => (hasPassword ? setAsking((v) => !v) : enter())}
        disabled={pending}
        className="flex min-h-14 w-full items-center gap-3 text-left disabled:opacity-50"
      >
        {children}
        {hasPassword && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" className="shrink-0 text-ink-3" aria-label={t.join.hasPassword}>
            <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        )}
      </button>

      {asking && (
        <div className="flex flex-col gap-2 pb-3">
          <input
            className={inputCls} type="password" autoFocus autoComplete="current-password"
            placeholder={t.join.password} aria-label={t.join.password}
            value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') enter(); }}
          />
          {error && <p className="text-[13px] text-attn">{error}</p>}
          <div className="flex gap-2">
            <button className={`${btnPrimary} flex-1`} onClick={enter} disabled={pending || !password}>
              {pending ? t.common.loading : t.join.enterAs}
            </button>
            <button className={btnGhost} onClick={() => { setAsking(false); setPassword(''); setError(''); }}>
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
