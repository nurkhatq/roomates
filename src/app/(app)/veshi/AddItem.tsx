'use client';
import { useActionState, useRef, useState } from 'react';
import { addItem, type FormState } from '@/lib/actions/items';
import { prepPhoto } from '@/lib/photo';
import { Card, btnPrimary, btnGhost, btnPlain, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';
import { unitOptions, altUnitOptions, DEFAULT_UNIT } from '@/lib/units';

type Mate = { id: string; name: string; index: number };

export function AddItem({ mates, meId }: { mates: Mate[]; meId: string }) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState('');
  const [working, setWorking] = useState(false);
  const [photoNote, setPhotoNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [added, setAdded] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Опись заводят пачкой: восемь вещей — это восемь раз открыть форму заново.
  // Поэтому после сохранения форма остаётся открытой и чистой, а закрывает её
  // кнопка «Готово».
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await addItem(prev, fd);
    if (res.ok) {
      setPhoto(''); setPhotoNote('');
      setAdded((n) => n + 1);
      formRef.current?.reset();
      formRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    }
    return res;
  }, {} as FormState);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorking(true);
    setPhotoNote(t.things.removingBg);
    try {
      const res = await prepPhoto(file, 'cutout');
      setPhoto(res.dataUrl);
      setPhotoNote(res.bgRemoved ? '' : t.things.bgFailed);
    } catch {
      setPhotoNote(t.things.photoFailed);
    } finally {
      setWorking(false);
    }
  };

  if (!open) {
    return <button className={`${btnPrimary} mb-3 w-full`} onClick={() => setOpen(true)}>{t.things.add}</button>;
  }

  return (
    <Card>
      <form ref={formRef} action={action} className="flex flex-col gap-3.5">
        <input type="hidden" name="photo" value={photo} />

        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunk">
            {photo
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={photo} alt="" className="h-16 w-16 object-contain" />
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                  className="text-ink-3" aria-hidden="true">
                  <rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.2" />
                  <path d="M8 6l1.5-2h5L16 6" /></svg>}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <button type="button" className={btnPlain} onClick={() => fileRef.current?.click()} disabled={working}>
              {working ? t.things.removingBg : t.things.takePhoto}
            </button>
            {photoNote && <span className="text-[11.5px] text-ink-3">{photoNote}</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        </div>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.things.name}</span>
          <input name="name" className={inputCls} required autoComplete="off" placeholder="Туалетная бумага" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.things.unit}</span>
            <select name="unit" className={inputCls} defaultValue={DEFAULT_UNIT}>
              {unitOptions().map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.things.boughtQty}</span>
            <input name="qty" className={`${inputCls} num`} type="number" inputMode="decimal" min="0" step="0.5" placeholder="12" />
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <span className={labelCls}>{t.things.altUnit}</span>
          <div className="grid grid-cols-2 gap-3">
            <select name="altUnit" className={inputCls} defaultValue="" aria-label={t.things.altUnit}>
              <option value="">{t.things.altNone}</option>
              {altUnitOptions().map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <input name="altQty" className={`${inputCls} num`} type="number" inputMode="decimal"
              min="0" step="0.5" placeholder="10" aria-label={t.things.altQty} />
          </div>
          <span className="text-[11.5px] text-ink-3">{t.things.altHint}</span>
        </div>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.things.price}</span>
          <input name="price" className={`${inputCls} num`} type="number" inputMode="numeric"
            min="0" placeholder="—" />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.things.interval}</span>
          <input name="interval" className={`${inputCls} num`} type="number" inputMode="numeric" min="1" defaultValue={7} />
          <span className="text-[11.5px] text-ink-3">{t.things.intervalHint}</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.things.owner}</span>
          <select name="ownerId" defaultValue="" className={inputCls}>
            <option value="">{t.things.sharedOption}</option>
            {mates.map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.id === meId ? ` (${t.common.you})` : ''}</option>
            ))}
          </select>
        </label>

        {state.error && <p className="text-[13px] text-attn">{state.error}</p>}

        {added > 0 && (
          <p className="text-[12px] text-ink-3">{t.things.addedCount} {added}</p>
        )}

        <div className="flex gap-2">
          <button className={`${btnPrimary} flex-1`} disabled={pending || working}>
            {pending ? t.common.loading : added > 0 ? t.things.saveNext : t.common.save}
          </button>
          <button type="button" className={btnGhost} onClick={() => { setOpen(false); setAdded(0); }}>
            {added > 0 ? t.things.doneAdding : t.common.cancel}
          </button>
        </div>
      </form>
    </Card>
  );
}
