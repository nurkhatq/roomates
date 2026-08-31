'use client';
import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { recordStock, archiveItem, setItemPhoto } from '@/lib/actions/items';
import { prepPhoto } from '@/lib/photo';
import type { StockState } from '@/lib/stock';
import { btnPlain, btnGhost, btnPrimary, btnDanger, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';

export type CardItem = {
  id: string; name: string; unit: string; ownerId: string | null;
  checkIntervalDays: number; hasPhoto: boolean; photoVersion: number;
};
type Mate = { id: string; name: string; index: number };

const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });
const round1 = (n: number) => Math.round(n * 10) / 10;

export function ItemCard({
  item, st, flag, mates,
}: { item: CardItem; st: StockState; flag: 'check' | 'buy' | null; mates: Mate[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'check' | 'buy'>('check');
  const [qty, setQty] = useState('');
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const owner = item.ownerId ? mates.find((m) => m.id === item.ownerId) : null;

  const headline = st.current !== null ? `${round1(st.current)} ${item.unit}` : t.things.checkedNever;
  // На плитке помещается одна короткая строка. Длинное «расход пока
  // неизвестен» уезжает в карточку, где для него есть место.
  const sub = st.daysLeft !== null
    ? `${t.things.daysLeft} ${Math.floor(st.daysLeft)} ${t.things.days}`
    : '';

  const submit = () => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n < 0) return;
    start(async () => {
      await recordStock(item.id, mode === 'buy' ? 'purchase' : 'check', n);
      setQty(''); setOpen(false);
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
        <span className="relative mb-2 flex aspect-square w-full items-center justify-center">
          {item.hasPhoto ? (
            <Image src={`/api/photo/${item.id}?v=${item.photoVersion}`} alt="" fill sizes="(max-width:560px) 45vw, 180px"
              className="object-contain" unoptimized />
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
                {item.hasPhoto ? (
                  <Image src={`/api/photo/${item.id}?v=${item.photoVersion}`} alt="" fill sizes="56px"
                    className="object-contain" unoptimized />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[16px] font-semibold">{item.name}</h3>
                <p className="num text-[12px] leading-snug text-ink-3">
                  {headline}
                  {st.ratePerDay
                    ? ` · ${round1(st.ratePerDay)} ${item.unit} ${t.things.perDay}`
                    : st.current !== null ? ` · ${t.things.unknownRate}` : ''}
                  {st.nextCheckOn ? ` · ${t.things.nextCheck} ${dayFmt.format(st.nextCheckOn)}` : ''}
                </p>
              </div>
            </div>

            <div className="mb-3 flex gap-2">
              <button className={mode === 'check' ? btnPlain : btnGhost} onClick={() => setMode('check')}>
                {t.things.check}
              </button>
              <button className={mode === 'buy' ? btnPlain : btnGhost} onClick={() => setMode('buy')}>
                {t.things.bought}
              </button>
            </div>

            <label className="mb-3 flex flex-col gap-1">
              <span className={labelCls}>
                {mode === 'check' ? t.things.checkQty : t.things.boughtQty} ({item.unit})
              </span>
              <input className={`${inputCls} num`} type="number" inputMode="decimal" min="0" step="0.5"
                value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            </label>

            <button className={`${btnPrimary} mb-3 w-full`} onClick={submit} disabled={pending || qty === ''}>
              {pending ? t.common.loading : t.common.save}
            </button>

            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <button className={btnGhost} onClick={() => fileRef.current?.click()} disabled={working}>
                {working ? t.things.removingBg : item.hasPhoto ? t.things.replacePhoto : t.things.takePhoto}
              </button>
              {note && <span className="text-[11.5px] text-ink-3">{note}</span>}
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                onChange={onFile} className="hidden" />
              <div className="flex gap-2">
                <button className={`${btnGhost} flex-1`} onClick={() => setOpen(false)}>{t.common.cancel}</button>
                <button className={btnDanger} disabled={pending}
                  onClick={() => start(() => { void archiveItem(item.id); })}>
                  {t.things.archive}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
