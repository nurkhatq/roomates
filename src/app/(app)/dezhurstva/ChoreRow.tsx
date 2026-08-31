'use client';
import { useState, useTransition } from 'react';
import { markChoreDone, archiveChore } from '@/lib/actions/chores';
import type { ChoreState } from '@/lib/chores';
import { Avatar, btnPlain, btnGhost, btnDanger } from '@/components/ui';
import { t } from '@/lib/strings';

type Mate = { id: string; name: string; index: number; photoVersion: number };

export function ChoreRow({
  id, name, st, mates, meId,
}: { id: string; name: string; st: ChoreState; mates: Mate[]; meId: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const crew = st.assignees.map((id) => mates.find((m) => m.id === id)).filter(Boolean) as Mate[];

  // Только факты: сколько дней прошло и чья очередь. Ничего не краснеет.
  let when: string;
  if (st.daysSince === null) when = t.chores.neverDone;
  else if (st.daysUntilDue === null) when = '';
  else if (st.daysUntilDue < -0.5) when = `${t.chores.overdueBy} ${Math.floor(-st.daysUntilDue)} ${t.chores.days}`;
  else if (st.daysUntilDue < 1) when = t.chores.dueToday;
  else when = `${t.chores.dueIn} ${Math.floor(st.daysUntilDue)} дн.`;

  return (
    <div className="border-b border-line last:border-b-0">
    <div className="flex items-center gap-3 py-2.5">
      {crew.length > 0 && (
        <span className="flex shrink-0 -space-x-1.5">
          {crew.map((m) => <Avatar key={m.id} name={m.name} index={m.index} size={26}
            memberId={m.id} photoVersion={m.photoVersion} />)}
        </span>
      )}
      <button className="min-w-0 flex-1 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="truncate text-[14.5px]">{name}</div>
        <div className="truncate text-[11.5px] text-ink-3">
          {crew.length
            ? `${t.chores.turnOf} ${crew.map((m) => m.name + (m.id === meId ? ` (${t.common.you})` : '')).join(t.common.and)}`
            : ''}
          {when ? ` · ${when}` : ''}
          {st.daysSince !== null ? ` · ${Math.floor(st.daysSince)} ${t.chores.daysSince}` : ''}
        </div>
      </button>
      <button
        className={`${btnPlain} shrink-0 px-3`}
        disabled={pending}
        onClick={() => start(() => { void markChoreDone(id); })}
      >
        {pending ? '…' : t.chores.done}
      </button>
    </div>
    {open && (
      <div className="flex gap-2 pb-2.5">
        <button className={`${btnDanger} flex-1`} disabled={pending}
          onClick={() => start(() => { void archiveChore(id); })}>
          {t.chores.remove}
        </button>
        <button className={btnGhost} onClick={() => setOpen(false)}>{t.common.cancel}</button>
      </div>
    )}
    </div>
  );
}
