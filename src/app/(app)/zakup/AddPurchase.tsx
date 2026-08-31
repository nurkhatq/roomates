'use client';
import { useActionState, useMemo, useState } from 'react';
import { addPurchase, type FormState } from '@/lib/actions/purchases';
import { splitEqual, money } from '@/lib/money';
import { Avatar, Card, btnPrimary, btnGhost, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';

type Mate = { id: string; name: string; index: number };
export type ShelfItem = {
  id: string; name: string; unit: string;
  price: number | null; altUnit: string | null; altQty: number | null; needed: boolean;
};
/** qty хранится в той мере, что выбрана в строке; в базовые единицы переводим при отправке. */
type Line = { qty: string; amount: string; alt: boolean };

const today = () => new Date().toISOString().slice(0, 10);

const BLANK_LINE: Line = { qty: '', amount: '', alt: false };

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
    for (const i of needed) seeded[i.id] = { ...BLANK_LINE };
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
      void item;
      return { ...l, [id]: { ...BLANK_LINE } };
    });

  const chosen = Object.entries(lines);
  const subtotal = chosen.reduce((a, [, v]) => a + (Math.round(Number(v.amount)) || 0), 0);
  const factorOf = (id: string, v: Line) => {
    const it = shelf.find((x) => x.id === id);
    return v.alt && it?.altQty ? it.altQty : 1;
  };
  const payload = chosen.map(([itemId, v]) => ({
    itemId,
    qty: (Number(v.qty) || 0) * factorOf(itemId, v),
    amount: Math.round(Number(v.amount)) || 0,
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
                {/* Название на своей строке, поля под ним: втиснуть в один ряд
                    галочку, имя, количество, меру и цену на 375px невозможно —
                    название сжималось до пары букв. */}
                {shelf.map((i) => {
                  const line = lines[i.id];
                  const on = Boolean(line);
                  const canAlt = Boolean(i.altUnit && i.altQty && i.altQty > 0);
                  const base = on && line.alt && i.altQty ? (Number(line.qty) || 0) * i.altQty : null;
                  return (
                    <div key={i.id} className="border-b border-line py-2 last:border-b-0">
                      <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                        <input type="checkbox" checked={on} onChange={() => toggleLine(i.id, i)}
                          className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
                        <span className="min-w-0 flex-1 truncate text-[14px]">{i.name}</span>
                        {i.needed && <span className="shrink-0 text-[11px] text-attn">{t.things.buyShort}</span>}
                        {i.price !== null && (
                          <span className="num shrink-0 text-[11px] text-ink-3">{money(i.price)}/{i.unit}</span>
                        )}
                      </label>

                      {on && (
                        <div className="mt-1.5 flex items-center gap-2 pl-7">
                          <input value={line.qty} onChange={(e) => setLine(i.id, { qty: e.target.value })}
                            onFocus={(e) => e.target.select()}
                            type="number" inputMode="decimal" min="0" step="0.5" placeholder="1"
                            className={`${inputCls} num w-20 px-2 text-right`}
                            aria-label={`${i.name}: сколько`} />
                          {canAlt ? (
                            <button type="button" onClick={() => setLine(i.id, { alt: !line.alt })}
                              className="min-h-11 shrink-0 rounded-lg border border-line-2 px-2.5 text-[12.5px]"
                              aria-label={`${i.name}: мера`}>
                              {line.alt ? i.altUnit : i.unit}
                            </button>
                          ) : (
                            <span className="shrink-0 text-[12px] text-ink-3">{i.unit}</span>
                          )}
                          <input value={line.amount} onChange={(e) => setLine(i.id, { amount: e.target.value })}
                            onFocus={(e) => e.target.select()}
                            type="number" inputMode="numeric" min="0" placeholder="тг"
                            className={`${inputCls} num min-w-0 flex-1 px-2 text-right`}
                            aria-label={`${i.name}: сколько отдали`} />
                        </div>
                      )}
                      {base !== null && line.qty !== '' && (
                        <div className="num pl-7 pt-1 text-[11px] text-ink-3">
                          = {Math.round(base * 10) / 10} {i.unit}
                        </div>
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
