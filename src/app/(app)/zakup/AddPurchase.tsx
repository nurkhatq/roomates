'use client';
import { useActionState, useState } from 'react';
import { addPurchase, type FormState } from '@/lib/actions/purchases';
import { splitEqual, money } from '@/lib/money';
import { Avatar, Card, btnPrimary, btnGhost, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';

type Mate = { id: string; name: string; index: number };
const today = () => new Date().toISOString().slice(0, 10);

export function AddPurchase({ roommates, meId }: { roommates: Mate[]; meId: string }) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState('');
  const [picked, setPicked] = useState<string[]>(roommates.map((m) => m.id));

  // Сброс делается прямо в действии, а не эффектом: эффект на изменение
  // результата вызывает лишний каскад рендеров.
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await addPurchase(prev, fd);
    if (res.ok) {
      setOpen(false);
      setTotal('');
      setPicked(roommates.map((m) => m.id));
    }
    return res;
  }, {} as FormState);

  if (!open) {
    return (
      <button className={`${btnPrimary} mb-3 w-full`} onClick={() => setOpen(true)}>
        {t.money.addPurchase}
      </button>
    );
  }

  const amount = Math.round(Number(total)) || 0;
  const per = picked.length && amount > 0 ? splitEqual(amount, picked.length) : [];
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Card>
      <form action={action} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.money.amount}</span>
          <input name="total" value={total} onChange={(e) => setTotal(e.target.value)}
            className={`${inputCls} num text-lg`} type="number" inputMode="numeric" min="1"
            placeholder="18130" required autoFocus />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.money.who}</span>
          <select name="payerId" defaultValue={meId} className={inputCls}>
            {roommates.map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.id === meId ? ` (${t.common.you})` : ''}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>{t.money.participants}</span>
          <div className="flex flex-col">
            {roommates.map((m) => (
              <label key={m.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-line last:border-b-0">
                <input type="checkbox" name="participants" value={m.id}
                  checked={picked.includes(m.id)} onChange={() => toggle(m.id)}
                  className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
                <Avatar name={m.name} index={m.index} size={26} />
                <span className="min-w-0 flex-1 truncate text-[14px]">{m.name}</span>
                {per.length > 0 && picked.includes(m.id) && (
                  <span className="num shrink-0 text-[13px] text-ink-2">
                    {money(per[picked.indexOf(m.id)])}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.money.note}</span>
          <input name="note" className={inputCls} placeholder="Магнум, продукты" autoComplete="off" />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.money.date}</span>
          <input name="date" type="date" defaultValue={today()} className={`${inputCls} num`} />
        </label>

        {state.error && <p className="text-[13px] text-attn">{state.error}</p>}

        <div className="flex gap-2">
          <button className={`${btnPrimary} flex-1`} disabled={pending}>
            {pending ? t.common.loading : t.money.save}
          </button>
          <button type="button" className={btnGhost} onClick={() => setOpen(false)}>
            {t.money.cancel}
          </button>
        </div>
      </form>
    </Card>
  );
}
