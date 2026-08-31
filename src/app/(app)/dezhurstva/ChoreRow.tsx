'use client';
import { useTransition } from 'react';
import { markChoreDone } from '@/lib/actions/chores';
import type { ChoreState } from '@/lib/chores';
import { Avatar, btnPlain } from '@/components/ui';
import { t } from '@/lib/strings';

type Mate = { id: string; name: string; index: number };

export function ChoreRow({
  id, name, st, mates, meId,
}: { id: string; name: string; st: ChoreState; mates: Mate[]; meId: string }) {
  const [pending, start] = useTransition();
  const who = mates.find((m) => m.id === st.assignee);

  // Только факты: сколько дней прошло и чья очередь. Ничего не краснеет.
  let when: string;
  if (st.daysSince === null) when = t.chores.neverDone;
  else if (st.daysUntilDue === null) when = '';
  else if (st.daysUntilDue < -0.5) when = `${t.chores.overdueBy} ${Math.floor(-st.daysUntilDue)} ${t.chores.days}`;
  else if (st.daysUntilDue < 1) when = t.chores.dueToday;
  else when = `${t.chores.dueIn} ${Math.floor(st.daysUntilDue)} дн.`;

  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      {who && <Avatar name={who.name} index={who.index} size={26} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px]">{name}</div>
        <div className="truncate text-[11.5px] text-ink-3">
          {who ? `${t.chores.turnOf} ${who.name}${who.id === meId ? ` (${t.common.you})` : ''}` : ''}
          {when ? ` · ${when}` : ''}
          {st.daysSince !== null ? ` · ${Math.floor(st.daysSince)} ${t.chores.daysSince}` : ''}
        </div>
      </div>
      <button
        className={`${btnPlain} shrink-0 px-3`}
        disabled={pending}
        onClick={() => start(() => { void markChoreDone(id, meId); })}
      >
        {pending ? '…' : t.chores.done}
      </button>
    </div>
  );
}
