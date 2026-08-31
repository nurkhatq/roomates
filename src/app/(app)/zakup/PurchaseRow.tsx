'use client';
import { useState, useTransition } from 'react';
import { deletePurchase } from '@/lib/actions/purchases';
import { btnGhost, btnDanger } from '@/components/ui';
import { t } from '@/lib/strings';

/**
 * Тап по строке раскрывает удаление. Кнопка-корзина в самой строке не влезает
 * на 375px рядом с суммой, а ошибиться в сумме при вводе — обычное дело.
 */
export function PurchaseRow({
  id, children, inside,
}: { id: string; children: React.ReactNode; inside: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="border-b border-line last:border-b-0">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-2.5 text-left"
        aria-expanded={open}>
        {children}
      </button>
      {open && inside.length > 0 && (
        <div className="pb-2 pl-9">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            {t.money.whatInside}
          </p>
          <ul className="flex flex-col gap-0.5">
            {inside.map((line) => (
              <li key={line} className="num text-[12px] text-ink-2">{line}</li>
            ))}
          </ul>
        </div>
      )}
      {open && (
        <div className="flex gap-2 pb-2.5">
          <button className={`${btnDanger} flex-1`} disabled={pending}
            onClick={() => start(() => { void deletePurchase(id); })}>
            {pending ? t.common.loading : t.common.delete}
          </button>
          <button className={btnGhost} onClick={() => setOpen(false)}>{t.common.cancel}</button>
        </div>
      )}
    </div>
  );
}
