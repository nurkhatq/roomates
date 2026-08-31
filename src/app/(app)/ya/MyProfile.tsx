'use client';
import { useActionState, useState } from 'react';
import { setMyPhoto, updateMyName, type FormState } from '@/lib/actions/household';
import { leaveSession } from '@/lib/actions/auth';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Card, Eyebrow, btnPrimary, btnGhost, inputCls, labelCls } from '@/components/ui';
import { personVar } from '@/lib/colors';
import { t } from '@/lib/strings';

export function MyProfile({
  name, memberId, photoVersion, index,
}: { name: string; memberId: string; photoVersion: number | null; index: number }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await updateMyName(prev, fd);
    if (res.ok) setEditing(false);
    return res;
  }, {} as FormState);

  return (
    <Card>
      <Eyebrow>{t.me.title}</Eyebrow>
      <PhotoPicker
        src={photoVersion ? `/api/photo/member/${memberId}?v=${photoVersion}` : null}
        alt={name}
        label={t.me.setPhoto}
        size={72}
        round
        onPick={setMyPhoto}
      />

      {editing ? (
        <form action={action} className="mt-3 flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.me.name}</span>
            <input name="name" className={inputCls} defaultValue={name} required autoFocus />
          </label>
          {state.error && <p className="text-[13px] text-attn">{state.error}</p>}
          <div className="flex gap-2">
            <button className={`${btnPrimary} flex-1`} disabled={pending}>{t.common.save}</button>
            <button type="button" className={btnGhost} onClick={() => setEditing(false)}>{t.common.cancel}</button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <span className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ background: `var(${personVar(index)})` }} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{name}</span>
          <button className={btnGhost} onClick={() => setEditing(true)}>{t.things.edit}</button>
        </div>
      )}

      <form action={leaveSession} className="mt-3">
        <button className={`${btnGhost} w-full`}>{t.common.leave}</button>
      </form>
    </Card>
  );
}
