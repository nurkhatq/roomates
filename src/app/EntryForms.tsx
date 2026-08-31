'use client';
import { useActionState, useState } from 'react';
import { enterByCode, createHousehold, type FormState } from '@/lib/actions/auth';
import { btnPrimary, btnGhost, inputCls, labelCls, Card } from '@/components/ui';
import { t } from '@/lib/strings';

const EMPTY: FormState = {};

export function EntryForms() {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [joinState, joinAction, joinPending] = useActionState(enterByCode, EMPTY);
  const [makeState, makeAction, makePending] = useActionState(createHousehold, EMPTY);

  if (mode === 'create') {
    return (
      <Card>
        <form action={makeAction} className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t.join.createTitle}</h2>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.join.createName}</span>
            <input name="houseName" className={inputCls} required autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.join.yourName}</span>
            <input name="yourName" className={inputCls} required autoComplete="given-name" />
          </label>
          {makeState.error && <p className="text-[13px] text-attn">{makeState.error}</p>}
          <button className={btnPrimary} disabled={makePending}>
            {makePending ? t.common.loading : t.join.createCta}
          </button>
          <button type="button" className={btnGhost} onClick={() => setMode('join')}>
            {t.common.cancel}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <form action={joinAction} className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.join.title}</h2>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.join.codeLabel}</span>
          <input name="code" className={`${inputCls} num uppercase`} placeholder={t.join.codePlaceholder}
            required autoComplete="off" autoCapitalize="characters" />
        </label>
        {joinState.error && <p className="text-[13px] text-attn">{joinState.error}</p>}
        <button className={btnPrimary} disabled={joinPending}>
          {joinPending ? t.common.loading : t.join.enter}
        </button>
        <button type="button" className={btnGhost} onClick={() => setMode('create')}>
          {t.join.orCreate}
        </button>
      </form>
    </Card>
  );
}
