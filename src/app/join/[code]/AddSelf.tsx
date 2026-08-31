'use client';
import { useActionState, useState } from 'react';
import { addSelfAndJoin, type FormState } from '@/lib/actions/auth';
import { btnPrimary, btnGhost, inputCls, labelCls, Card } from '@/components/ui';
import { t } from '@/lib/strings';

export function AddSelf({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addSelfAndJoin, {} as FormState);

  if (!open) {
    return <button className={`${btnGhost} w-full`} onClick={() => setOpen(true)}>{t.join.notListed}</button>;
  }
  return (
    <Card>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="code" value={code} />
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.join.yourName}</span>
          <input name="name" className={inputCls} required autoFocus autoComplete="given-name" />
        </label>
        {state.error && <p className="text-[13px] text-attn">{state.error}</p>}
        <button className={btnPrimary} disabled={pending}>{t.join.addMe}</button>
        <button type="button" className={btnGhost} onClick={() => setOpen(false)}>{t.common.cancel}</button>
      </form>
    </Card>
  );
}
