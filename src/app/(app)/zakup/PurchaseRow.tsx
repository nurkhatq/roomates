'use client';
import { useState, useTransition } from 'react';
import Image from 'next/image';
import { deletePurchase, setPurchasePhoto } from '@/lib/actions/purchases';
import { prepPhoto } from '@/lib/photo';
import { money } from '@/lib/money';
import { Avatar, btnGhost, btnDanger } from '@/components/ui';
import { t } from '@/lib/strings';
import { useRef } from 'react';

export type RowShare = {
  id: string; name: string; index: number; photoVersion: number;
  amount: number; isMe: boolean;
};
export type RowItem = { name: string; qty: number; unit: string; amount: number };

/**
 * Тап по строке раскрывает подробности: кто сколько должен по этой записи,
 * что лежало в пакете и чек. Кнопка-корзина прямо в строке не влезает на
 * 375px рядом с суммой, а ошибиться в сумме при вводе — обычное дело.
 */
export function PurchaseRow({
  id, children, shares, items, receiptVersion, canEdit,
}: {
  id: string; children: React.ReactNode;
  shares: RowShare[]; items: RowItem[];
  receiptVersion: number; canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setNote(t.common.loading);
    try {
      const res = await prepPhoto(file, 'plain');
      const problem = await setPurchasePhoto(id, res.dataUrl);
      setNote(problem || '');
    } catch {
      setNote(t.things.photoFailed);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="border-b border-line last:border-b-0">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-2.5 text-left" aria-expanded={open}>
        {children}
      </button>

      {open && (
        <div className="flex flex-col gap-3 pb-3">
          {shares.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                {t.money.whoOwes}
              </p>
              <div className="flex flex-col">
                {shares.map((sh) => (
                  <div key={sh.id} className="flex items-center gap-2 py-1">
                    <Avatar name={sh.name} index={sh.index} size={22}
                      memberId={sh.id} photoVersion={sh.photoVersion} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {sh.name}{sh.isMe ? t.common.youSuffix : ''}
                    </span>
                    <span className="num text-[13px] text-ink-2">{money(sh.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                {t.money.whatInside}
              </p>
              <div className="flex flex-col">
                {items.map((it) => (
                  <div key={it.name} className="flex items-baseline gap-2 py-0.5">
                    <span className="min-w-0 flex-1 truncate text-[13px]">{it.name}</span>
                    <span className="num text-[12px] text-ink-3">{it.qty} {it.unit}</span>
                    {it.amount > 0 && <span className="num text-[12.5px] text-ink-2">{money(it.amount)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              {t.money.receipt}
            </p>
            {receiptVersion > 0 ? (
              /* Чек открывается в полный размер: на превью цифры не прочитать. */
              <a href={`/api/photo/receipt/${id}?v=${receiptVersion}`} target="_blank" rel="noopener noreferrer"
                className="relative block h-32 w-24 overflow-hidden rounded-lg border border-line bg-sunk">
                <Image src={`/api/photo/receipt/${id}?v=${receiptVersion}`} alt={t.money.receipt}
                  fill sizes="96px" className="object-cover" unoptimized />
              </a>
            ) : (
              <p className="text-[12.5px] text-ink-3">{t.money.noReceipt}</p>
            )}
            {canEdit && (
              <>
                <button className={`${btnGhost} mt-2`} onClick={() => fileRef.current?.click()} disabled={busy}>
                  {busy ? t.common.loading : receiptVersion > 0 ? t.money.replaceReceipt : t.money.addReceipt}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
              </>
            )}
            {note && <p className="mt-1 text-[11.5px] text-ink-3">{note}</p>}
          </div>

          <div className="flex gap-2">
            {canEdit ? (
              <button className={`${btnDanger} flex-1`} disabled={pending}
                onClick={() => start(() => { void deletePurchase(id); })}>
                {pending ? t.common.loading : t.common.delete}
              </button>
            ) : (
              <span className="flex-1 self-center text-[12px] text-ink-3">{t.money.notYours}</span>
            )}
            <button className={btnGhost} onClick={() => setOpen(false)}>{t.common.cancel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
