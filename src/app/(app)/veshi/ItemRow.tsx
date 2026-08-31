'use client';
import { useState, useTransition } from 'react';
import Image from 'next/image';
import { recordStock, archiveItem } from '@/lib/actions/items';
import type { StockState } from '@/lib/stock';
import { btnPlain, btnGhost, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';

type Item = {
  id: string; name: string; unit: string; ownerId: string | null; checkIntervalDays: number;
  hasPhoto: boolean;
};
type Mate = { id: string; name: string; index: number };

const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });
const round1 = (n: number) => Math.round(n * 10) / 10;

export function ItemRow({
  item, st, highlight, mates,
}: { item: Item; st: StockState; highlight?: 'check' | 'buy'; mates: Mate[] }) {
  const [mode, setMode] = useState<null | 'buy' | 'check'>(null);
  const [qty, setQty] = useState('');
  const [pending, start] = useTransition();
  const owner = item.ownerId ? mates.find((m) => m.id === item.ownerId) : null;

  const submit = () => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n < 0 || mode === null) return;
    start(async () => {
      await recordStock(item.id, mode === 'buy' ? 'purchase' : 'check', n);
      setMode(null);
      setQty('');
    });
  };

  // Что мы вообще знаем про эту вещь — одной строкой, без оценок и приказов
  const facts: string[] = [];
  if (st.current !== null) facts.push(`${round1(st.current)} ${item.unit} ${t.things.left}`);
  if (st.ratePerDay !== null && st.ratePerDay > 0) {
    facts.push(`${round1(st.ratePerDay)} ${item.unit} ${t.things.perDay}`);
    if (st.daysLeft !== null) facts.push(`${t.things.daysLeft} ${Math.floor(st.daysLeft)} ${t.things.days}`);
  } else {
    facts.push(st.current === null ? t.things.checkedNever : t.things.unknownRate);
  }
  if (st.confidence === 'rough') facts.push(t.things.roughRate);

  return (
    <div className="border-b border-line py-2.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunk">
          {item.hasPhoto ? (
            <Image src={`/api/photo/${item.id}`} alt="" width={44} height={44}
              className="h-11 w-11 object-contain" unoptimized />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.6" className="text-ink-3" aria-hidden="true">
              <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" /><path d="M4 8.5 12 13l8-4.5M12 13v7" />
            </svg>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14.5px]">{item.name}</span>
            {owner && (
              <span className="shrink-0 rounded border border-line px-1.5 text-[10.5px] text-ink-3">
                {owner.name}
              </span>
            )}
          </div>
          <div className="num text-[11.5px] leading-snug text-ink-3">{facts.join(' · ')}</div>
        </div>
        {highlight === 'check' ? (
          <button className={`${btnPlain} shrink-0 px-3`} onClick={() => setMode('check')}>{t.things.check}</button>
        ) : highlight === 'buy' ? (
          <button className={`${btnPlain} shrink-0 px-3`} onClick={() => setMode('buy')}>{t.things.bought}</button>
        ) : (
          <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-3"
            aria-label={`${item.name}: действия`} onClick={() => setMode(mode ? null : 'check')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        )}
      </div>

      {mode && (
        <div className="mt-2.5 flex flex-col gap-2 rounded-lg bg-sunk p-3">
          <div className="flex gap-2">
            <button className={mode === 'check' ? btnPlain : btnGhost} onClick={() => setMode('check')}>
              {t.things.check}
            </button>
            <button className={mode === 'buy' ? btnPlain : btnGhost} onClick={() => setMode('buy')}>
              {t.things.bought}
            </button>
          </div>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>
              {mode === 'check' ? t.things.checkQty : t.things.boughtQty} ({item.unit})
            </span>
            <input className={`${inputCls} num`} type="number" inputMode="decimal" min="0" step="0.5"
              value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          </label>
          {st.nextCheckOn && mode === 'check' && (
            <p className="text-[11.5px] text-ink-3">
              {t.things.nextCheck}: <span className="num">{dayFmt.format(st.nextCheckOn)}</span>
            </p>
          )}
          <div className="flex gap-2">
            <button className={`${btnPlain} flex-1`} onClick={submit} disabled={pending || qty === ''}>
              {pending ? t.common.loading : t.common.save}
            </button>
            <button className={btnGhost} onClick={() => { setMode(null); setQty(''); }}>{t.common.cancel}</button>
            <button className={`${btnGhost} text-ink-3`}
              onClick={() => start(() => { void archiveItem(item.id); })} aria-label={t.things.archive}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
