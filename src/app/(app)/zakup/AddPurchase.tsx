'use client';
import { useActionState, useMemo, useState } from 'react';
import { addPurchase, type FormState } from '@/lib/actions/purchases';
import { splitEqual, money } from '@/lib/money';
import { Avatar, Card, btnPrimary, btnGhost, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';

type Mate = { id: string; name: string; index: number };
export type ShelfItem = { id: string; name: string; unit: string; price: number | null; needed: boolean };
type Line = { qty: string; amount: string };

const today = () => new Date().toISOString().slice(0, 10);

const BLANK_LINE: Line = { qty: '1', amount: '' };

export function AddPurchase({
  roommates, meId, shelf,
}: { roommates: Mate[]; meId: string; shelf: ShelfItem[] }) {
  const needed = useMemo(() => shelf.filter((i) => i.needed), [shelf]);

  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState('');
  const [picked, setPicked] = useState<string[]>(roommates.map((m) => m.id));
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [showShelf, setShowShelf] = useState(false);

  // Сброс делается прямо в действии, а не эффектом: эффект на изменение
  // результата вызывает лишний каскад рендеров.
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await addPurchase(prev, fd);
    if (res.ok) {
      setOpen(false); setTotal(''); setLines({}); setShowShelf(false);
      setPicked(roommates.map((m) => m.id));
    }
    return res;
  }, {} as FormState);

  const openWithNeeded = () => {
    const seeded: Record<string, Line> = {};
    for (const i of needed) seeded[i.id] = { qty: '1', amount: i.price ? String(i.price) : '' };
    setLines(seeded);
    setShowShelf(true);
    setOpen(true);
  };

  if (!open) {
    return (
      <div className="mb-3 flex flex-col gap-2">
        <button className={`${btnPrimary} w-full`} onClick={() => setOpen(true)}>
          {t.money.addPurchase}
        </button>
        {needed.length > 0 && (
          <button className={`${btnGhost} w-full`} onClick={openWithNeeded}>
            {t.things.addToPurchase} ({needed.length})
          </button>
        )}
      </div>
    );
  }

  const amount = Math.round(Number(total)) || 0;
  const per = picked.length && amount > 0 ? splitEqual(amount, picked.length) : [];
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const setLine = (id: string, patch: Partial<Line>) =>
    setLines((l) => ({ ...l, [id]: { ...BLANK_LINE, ...l[id], ...patch } }));
  const toggleLine = (id: string, item: ShelfItem) =>
    setLines((l) => {
      if (l[id]) {
        const rest = { ...l };
        delete rest[id];
        return rest;
      }
      return { ...l, [id]: { qty: '1', amount: item.price ? String(item.price) : '' } };
    });

  const chosen = Object.entries(lines);
  const subtotal = chosen.reduce((a, [, v]) => a + (Math.round(Number(v.amount)) || 0), 0);
  const payload = chosen.map(([itemId, v]) => ({
    itemId, qty: Number(v.qty) || 0, amount: Math.round(Number(v.amount)) || 0,
  }));

  return (
    <Card>
      <form action={action} className="flex flex-col gap-3.5">
        <input type="hidden" name="lines" value={JSON.stringify(payload)} />

        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.money.amount}</span>
          <input name="total" value={total} onChange={(e) => setTotal(e.target.value)}
            className={`${inputCls} num text-lg`} type="number" inputMode="numeric" min="1"
            placeholder="18130" required autoFocus />
        </label>

        {/* Позиции с полки: отметил — и остаток пополнится сам, второй раз
            вписывать те же цифры в каждую вещь не придётся. */}
        {shelf.length > 0 && (
          <div className="flex flex-col gap-2">
            <button type="button" className={`${btnGhost} justify-between`} onClick={() => setShowShelf((v) => !v)}>
              <span>{t.money.whatTook}</span>
              <span className="num text-ink-3">{chosen.length ? `${chosen.length}` : '—'}</span>
            </button>
            {showShelf && (
              <div className="flex flex-col">
                {shelf.map((i) => {
                  const on = Boolean(lines[i.id]);
                  return (
                    <div key={i.id} className="flex items-center gap-2 border-b border-line py-2 last:border-b-0">
                      <input type="checkbox" checked={on} onChange={() => toggleLine(i.id, i)}
                        className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                        aria-label={i.name} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">
                        {i.name}
                        {i.needed && <span className="ml-1 text-[11px] text-attn">{t.things.buyShort}</span>}
                      </span>
                      {on && (
                        <>
                          <input value={lines[i.id].qty} onChange={(e) => setLine(i.id, { qty: e.target.value })}
                            type="number" inputMode="decimal" min="0" step="0.5"
                            className={`${inputCls} num w-16 px-2 text-right`} aria-label={`${i.name}: сколько`} />
                          <span className="w-10 shrink-0 text-[11px] text-ink-3">{i.unit}</span>
                          <input value={lines[i.id].amount} onChange={(e) => setLine(i.id, { amount: e.target.value })}
                            type="number" inputMode="numeric" min="0" placeholder="₸"
                            className={`${inputCls} num w-20 px-2 text-right`} aria-label={`${i.name}: сколько отдали`} />
                        </>
                      )}
                    </div>
                  );
                })}
                {subtotal > 0 && (
                  <button type="button" className={`${btnGhost} mt-2`} onClick={() => setTotal(String(subtotal))}>
                    {t.money.useSubtotal}: {money(subtotal)}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

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
                  <span className="num shrink-0 text-[13px] text-ink-2">{money(per[picked.indexOf(m.id)])}</span>
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
          <button type="button" className={btnGhost} onClick={() => setOpen(false)}>{t.money.cancel}</button>
        </div>
      </form>
    </Card>
  );
}
