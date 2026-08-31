import Image from 'next/image';
import { personVar, initials } from '@/lib/colors';
import { t } from '@/lib/strings';

/**
 * Кружок жильца. Есть аватарка — показываем её, нет — инициалы.
 *
 * Кольцо цвета жильца остаётся в обоих случаях: по нему человека узнают в
 * списке, а инициалы на кольце всегда лежат на фоне карточки, поэтому их
 * контраст не зависит от того, какой цвет достался человеку.
 */
export function Avatar({
  name, index, size = 30, dimmed = false, memberId, photoVersion = 0,
}: {
  name: string; index: number; size?: number; dimmed?: boolean;
  memberId?: string; photoVersion?: number;
}) {
  const hasPhoto = Boolean(memberId) && photoVersion > 0;
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium"
      style={{
        width: size, height: size,
        fontSize: Math.round(size * 0.4),
        boxShadow: `inset 0 0 0 2px var(${personVar(index)})`,
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {hasPhoto ? (
        <Image src={`/api/photo/member/${memberId}?v=${photoVersion}`} alt="" fill
          sizes={`${size}px`} className="object-cover" unoptimized />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Точка цвета жильца — там, где текста на ней нет. */
export function Dot({ index, size = 8 }: { index: number; size?: number }) {
  return (
    <span aria-hidden="true" className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: `var(${personVar(index)})` }} />
  );
}

export function Person({
  name, index, you = false, memberId, photoVersion,
}: { name: string; index: number; you?: boolean; memberId?: string; photoVersion?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} index={index} size={26} memberId={memberId} photoVersion={photoVersion} />
      <span className="truncate">{name}{you ? t.common.youSuffix : ''}</span>
    </span>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`mb-3 rounded-xl border border-line bg-card p-4 ${className}`}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-3">{children}</p>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-ink-3">{children}</p>;
}

export function Attn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex gap-2 rounded-lg border border-attn-line bg-attn-bg px-3 py-2.5 text-[12.5px] leading-relaxed text-attn">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        className="mt-0.5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><circle cx="12" cy="16.5" r="1" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

const BTN = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium disabled:opacity-45';
export const btnPrimary = `${BTN} bg-accent text-accent-ink`;
export const btnPlain = `${BTN} border border-line-2 bg-card text-ink`;
export const btnGhost = `${BTN} border border-line bg-transparent text-ink`;
export const btnDanger = `${BTN} border border-attn-line bg-transparent text-attn`;
export const inputCls = 'min-h-11 w-full min-w-0 rounded-lg border border-line-2 bg-card px-3 py-2 focus:border-accent';
export const labelCls = 'text-[12px] font-medium text-ink-2';
