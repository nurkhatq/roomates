'use client';
import { useState, useTransition } from 'react';
import { deletePurchase } from '@/lib/actions/purchases';
import { btnGhost } from '@/components/ui';
import { t } from '@/lib/strings';

/**
 * Тап по строке раскрывает удаление. Кнопка-корзина в самой строке не влезает
 * на 375px рядом с суммой, а ошибиться в сумме при вводе — обычное дело.
 */
export function PurchaseRow({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="border-b border-line last:border-b-0">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-2.5 text-left"
        aria-expanded={open}>
        {children}
      </button>
      {open && (
        <div className="flex gap-2 pb-2.5">
          <button className={`${btnGhost} flex-1 text-attn`} disabled={pending}
            onClick={() => start(() => { void deletePurchase(id); })}>
            {pending ? t.common.loading : t.common.delete}
          </button>
          <button className={btnGhost} onClick={() => setOpen(false)}>{t.common.cancel}</button>
        </div>
      )}
    </div>
  );
}
