'use client';
import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { prepPhoto } from '@/lib/photo';
import { btnGhost } from '@/components/ui';
import { t } from '@/lib/strings';

/**
 * Съёмка и загрузка фото: фон убирается, картинка обрезается по содержимому.
 * Одна кнопка на все места — дом, аватарка, вещь.
 */
export function PhotoPicker({
  src, alt, size = 72, round = false, label, onPick,
}: {
  src: string | null; alt: string; size?: number; round?: boolean;
  label: string; onPick: (dataUrl: string) => Promise<void>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [, start] = useTransition();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setNote(t.things.removingBg);
    try {
      const res = await prepPhoto(file, true);
      await onPick(res.dataUrl);
      setNote(res.bgRemoved ? '' : t.things.bgFailed);
      start(() => {});
    } catch {
      setNote(t.things.photoFailed);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span
        className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-sunk ${round ? 'rounded-full' : 'rounded-xl'}`}
        style={{ width: size, height: size }}
      >
        {src ? (
          <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover" unoptimized />
        ) : (
          <svg width={size / 3} height={size / 3} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" className="text-ink-3" aria-hidden="true">
            <rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.2" />
            <path d="M8 6l1.5-2h5L16 6" />
          </svg>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button type="button" className={btnGhost} onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? t.things.removingBg : label}
        </button>
        {note && <span className="text-[11.5px] text-ink-3">{note}</span>}
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
    </div>
  );
}
