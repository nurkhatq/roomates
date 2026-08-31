'use client';
import { useActionState, useState } from 'react';
import { addChore, type FormState } from '@/lib/actions/chores';
import { Avatar, Card, btnPrimary, btnGhost, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';

type Mate = { id: string; name: string; index: number };

export function AddChore({ mates }: { mates: Mate[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(mates.map((m) => m.id));

  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await addChore(prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {} as FormState);

  if (!open) {
    return <button className={`${btnPrimary} mb-3 w-full`} onClick={() => setOpen(true)}>{t.chores.add}</button>;
  }

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Card>
      <form action={action} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.chores.name}</span>
          <input name="name" className={inputCls} required autoFocus autoComplete="off" placeholder="Пропылесосить" />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.chores.period}</span>
          <input name="periodDays" className={`${inputCls} num`} type="number" inputMode="numeric" min="1" defaultValue={7} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>{t.chores.order}</span>
          <div className="flex flex-col">
            {mates.map((m) => (
              <label key={m.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-line last:border-b-0">
                <input type="checkbox" name="order" value={m.id} checked={picked.includes(m.id)}
                  onChange={() => toggle(m.id)} className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
                <Avatar name={m.name} index={m.index} size={26} />
                <span className="min-w-0 flex-1 truncate text-[14px]">{m.name}</span>
              </label>
            ))}
          </div>
        </div>
        {state.error && <p className="text-[13px] text-attn">{state.error}</p>}
        <div className="flex gap-2">
          <button className={`${btnPrimary} flex-1`} disabled={pending}>{pending ? t.common.loading : t.common.save}</button>
          <button type="button" className={btnGhost} onClick={() => setOpen(false)}>{t.common.cancel}</button>
        </div>
      </form>
    </Card>
  );
}
