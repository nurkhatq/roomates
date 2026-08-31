'use client';
import { useActionState, useRef, useState } from 'react';
import { addItem, type FormState } from '@/lib/actions/items';
import { prepPhoto } from '@/lib/photo';
import { Card, btnPrimary, btnGhost, btnPlain, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';

type Mate = { id: string; name: string; index: number };

export function AddItem({ mates, meId }: { mates: Mate[]; meId: string }) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState('');
  const [working, setWorking] = useState(false);
  const [photoNote, setPhotoNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await addItem(prev, fd);
    if (res.ok) { setOpen(false); setPhoto(''); setPhotoNote(''); }
    return res;
  }, {} as FormState);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorking(true);
    setPhotoNote(t.things.removingBg);
    try {
      const res = await prepPhoto(file, true);
      setPhoto(res.dataUrl);
      setPhotoNote(res.bgRemoved ? '' : 'Фон убрать не вышло — оставил фото как есть');
    } catch {
      setPhotoNote('С этим файлом не получилось. Попробуй другое фото.');
    } finally {
      setWorking(false);
    }
  };

  if (!open) {
    return <button className={`${btnPrimary} mb-3 w-full`} onClick={() => setOpen(true)}>{t.things.add}</button>;
  }

  return (
    <Card>
      <form action={action} className="flex flex-col gap-3.5">
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
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
        </div>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.things.name}</span>
          <input name="name" className={inputCls} required autoComplete="off" placeholder="Туалетная бумага" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.things.unit}</span>
            <input name="unit" className={inputCls} defaultValue="шт" autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.things.boughtQty}</span>
            <input name="qty" className={`${inputCls} num`} type="number" inputMode="decimal" min="0" step="0.5" placeholder="12" />
          </label>
        </div>

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

        <div className="flex gap-2">
          <button className={`${btnPrimary} flex-1`} disabled={pending || working}>
            {pending ? t.common.loading : t.common.save}
          </button>
          <button type="button" className={btnGhost} onClick={() => setOpen(false)}>{t.common.cancel}</button>
        </div>
      </form>
    </Card>
  );
}
