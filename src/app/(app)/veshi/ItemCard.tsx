'use client';
import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { recordStock, archiveItem, setItemPhoto, updateItem } from '@/lib/actions/items';
import { prepPhoto } from '@/lib/photo';
import { unitOptions } from '@/lib/units';
import { money } from '@/lib/money';
import type { StockState } from '@/lib/stock';
import { btnPlain, btnGhost, btnPrimary, btnDanger, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';

export type CardItem = {
  id: string; name: string; unit: string; ownerId: string | null;
  checkIntervalDays: number; price: number | null;
  altUnit: string | null; altQty: number | null;
  hasPhoto: boolean; photoVersion: number;
};
type Mate = { id: string; name: string; index: number };

const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });
const round1 = (n: number) => Math.round(n * 10) / 10;

export function ItemCard({
  item, st, flag, mates,
}: { item: CardItem; st: StockState; flag: 'check' | 'buy' | null; mates: Mate[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'check' | 'buy'>('check');
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState('');
  // Считать можно в любой из двух мер: картошку берут килограммами, а на
  // полке пересчитывают штуками.
  const [inAlt, setInAlt] = useState(false);
  const canAlt = Boolean(item.altUnit && item.altQty && item.altQty > 0);
  const factor = canAlt && inAlt ? (item.altQty as number) : 1;
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const owner = item.ownerId ? mates.find((m) => m.id === item.ownerId) : null;

  const headline = st.current !== null ? `${round1(st.current)} ${item.unit}` : t.things.checkedNever;
  const sub = st.daysLeft !== null ? `${t.things.daysLeft} ${Math.floor(st.daysLeft)} ${t.things.days}` : '';
  const low = st.level !== null && st.level <= 0.3;

  const submit = () => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n < 0) return;
    start(async () => {
      await recordStock(item.id, mode === 'buy' ? 'purchase' : 'check', n * factor);
      setQty(''); setOpen(false);
    });
  };

  const saveEdit = (form: FormData) => {
    start(async () => {
      await updateItem(item.id, {
        name: String(form.get('name') ?? ''),
        unit: String(form.get('unit') ?? ''),
        price: String(form.get('price') ?? '').trim() === '' ? null : Number(form.get('price')),
        altUnit: String(form.get('altUnit') ?? ''),
        altQty: String(form.get('altQty') ?? '').trim() === '' ? null : Number(form.get('altQty')),
        checkIntervalDays: Number(form.get('interval')),
      });
      setEditing(false);
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorking(true); setNote(t.things.removingBg);
    try {
      const res = await prepPhoto(file, true);
      await setItemPhoto(item.id, res.dataUrl);
      setNote(res.bgRemoved ? '' : t.things.bgFailed);
    } catch {
      setNote(t.things.photoFailed);
    } finally {
      setWorking(false);
      e.target.value = '';
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex flex-col rounded-xl border border-line bg-card p-3 text-left">
        {/* Фото лежит прямо на фоне карточки: подложка вокруг вырезанного
            предмета выглядела бы как вторая рамка внутри первой. */}
        <span className="relative mb-2 flex aspect-[4/5] w-full items-center justify-center">
          {item.hasPhoto ? (
            <Image src={`/api/photo/item/${item.id}?v=${item.photoVersion}`} alt="" fill
              sizes="(max-width:560px) 45vw, 180px" className="object-contain" unoptimized />
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.3" className="text-ink-3" aria-hidden="true">
              <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" /><path d="M4 8.5 12 13l8-4.5M12 13v7" />
            </svg>
          )}
          {flag && (
            <span className="absolute left-0 top-0 rounded-md border border-attn-line bg-attn-bg px-1.5 py-0.5 text-[10.5px] font-medium text-attn">
              {flag === 'check' ? t.things.checkShort : t.things.buyShort}
            </span>
          )}
        </span>

        {/* Уровень показан длиной полоски, а не цветом: цвет в этом приложении
            занят людьми, и зелёный с жёлтым — это Арнур и Ерназар. */}
        {st.level !== null && (
          <span className="mb-1.5 block h-1 w-full overflow-hidden rounded-full bg-sunk"
            role="img" aria-label={`${t.things.level}: ${Math.round(st.level * 100)}%`}>
            <span className={`block h-full rounded-full ${low ? 'bg-attn' : 'bg-ink-2'}`}
              style={{ width: `${Math.max(3, st.level * 100)}%` }} />
          </span>
        )}

        <span className="truncate text-[14px] font-medium">{item.name}</span>
        <span className="num truncate text-[11.5px] text-ink-3">
          {headline}{sub ? ` · ${sub}` : ''}
        </span>
        {owner && <span className="mt-0.5 truncate text-[10.5px] text-ink-3">{owner.name}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true"
            className="max-h-[86vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl border border-line bg-card p-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] sm:rounded-2xl">
            <div className="mb-3 flex items-center gap-3">
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                {item.hasPhoto && (
                  <Image src={`/api/photo/item/${item.id}?v=${item.photoVersion}`} alt="" fill
                    sizes="56px" className="object-contain" unoptimized />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[16px] font-semibold">{item.name}</h3>
                <p className="num text-[12px] leading-snug text-ink-3">
                  {headline}
                  {item.price !== null ? ` · ${money(item.price)}/${item.unit}` : ''}
                  {st.ratePerDay
                    ? ` · ${round1(st.ratePerDay)} ${item.unit} ${t.things.perDay}`
                    : st.current !== null ? ` · ${t.things.unknownRate}` : ''}
                  {st.nextCheckOn ? ` · ${t.things.nextCheck} ${dayFmt.format(st.nextCheckOn)}` : ''}
                </p>
              </div>
            </div>

            {editing ? (
              <form action={saveEdit} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>{t.things.name}</span>
                  <input name="name" className={inputCls} defaultValue={item.name} required />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>{t.things.unit}</span>
                    <select name="unit" className={inputCls} defaultValue={item.unit}>
                      {unitOptions(item.unit).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>{t.things.price}</span>
                    <input name="price" type="number" inputMode="numeric" min="0"
                      className={`${inputCls} num`} defaultValue={item.price ?? ''} placeholder="—" />
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <span className={labelCls}>{t.things.altUnit}</span>
                  <div className="grid grid-cols-2 gap-3">
                    <input name="altUnit" className={inputCls} defaultValue={item.altUnit ?? ''}
                      placeholder={t.things.altExample} aria-label={t.things.altUnit} />
                    <input name="altQty" type="number" inputMode="decimal" min="0" step="0.5"
                      className={`${inputCls} num`} defaultValue={item.altQty ?? ''} placeholder="—"
                      aria-label={t.things.altQty} />
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>{t.things.interval}</span>
                  <input name="interval" type="number" inputMode="numeric" min="1"
                    className={`${inputCls} num`} defaultValue={item.checkIntervalDays} />
                </label>
                <div className="flex gap-2">
                  <button className={`${btnPrimary} flex-1`} disabled={pending}>{t.things.saveEdit}</button>
                  <button type="button" className={btnGhost} onClick={() => setEditing(false)}>
                    {t.common.cancel}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="mb-3 flex gap-2">
                  <button className={mode === 'check' ? btnPlain : btnGhost} onClick={() => setMode('check')}>
                    {t.things.check}
                  </button>
                  <button className={mode === 'buy' ? btnPlain : btnGhost} onClick={() => setMode('buy')}>
                    {t.things.bought}
                  </button>
                </div>

                <div className="mb-3 flex flex-col gap-1">
                  <span className={labelCls}>
                    {mode === 'check' ? t.things.checkQty : t.things.boughtQty}
                  </span>
                  <div className="flex gap-2">
                    <input className={`${inputCls} num flex-1`} type="number" inputMode="decimal" min="0" step="0.5"
                      value={qty} onChange={(e) => setQty(e.target.value)}
                      onFocus={(e) => e.target.select()} autoFocus
                      aria-label={mode === 'check' ? t.things.checkQty : t.things.boughtQty} />
                    {canAlt ? (
                      <button type="button" onClick={() => setInAlt((v) => !v)}
                        className="min-h-11 shrink-0 rounded-lg border border-line-2 px-3 text-[13px]">
                        {inAlt ? item.altUnit : item.unit}
                      </button>
                    ) : (
                      <span className="flex min-h-11 shrink-0 items-center px-2 text-[13px] text-ink-3">
                        {item.unit}
                      </span>
                    )}
                  </div>
                  {canAlt && inAlt && qty !== '' && (
                    <span className="num text-[11.5px] text-ink-3">
                      = {Math.round(Number(qty) * factor * 10) / 10} {item.unit}
                    </span>
                  )}
                </div>

                <button className={`${btnPrimary} mb-3 w-full`} onClick={submit} disabled={pending || qty === ''}>
                  {pending ? t.common.loading : t.common.save}
                </button>

                <div className="flex flex-col gap-2 border-t border-line pt-3">
                  <div className="flex gap-2">
                    <button className={`${btnGhost} flex-1`} onClick={() => fileRef.current?.click()} disabled={working}>
                      {working ? t.things.removingBg : item.hasPhoto ? t.things.replacePhoto : t.things.takePhoto}
                    </button>
                    <button className={`${btnGhost} flex-1`} onClick={() => setEditing(true)}>
                      {t.things.edit}
                    </button>
                  </div>
                  {note && <span className="text-[11.5px] text-ink-3">{note}</span>}
                  <input ref={fileRef} type="file" accept="image/*"
                    onChange={onFile} className="hidden" />
                  <div className="flex gap-2">
                    <button className={`${btnGhost} flex-1`} onClick={() => setOpen(false)}>{t.common.cancel}</button>
                    <button className={btnDanger} disabled={pending}
                      onClick={() => start(() => { void archiveItem(item.id); })}>
                      {t.things.archive}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
