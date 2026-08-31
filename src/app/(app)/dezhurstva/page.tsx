import { db } from '@/db';
import { requireSession } from '@/lib/session';
import { choresWithHistory } from '@/lib/queries';
import { choreState, type Chore } from '@/lib/chores';
import { Card, Eyebrow, Empty, Avatar } from '@/components/ui';
import { AddChore } from './AddChore';
import { ChoreRow } from './ChoreRow';
import { t } from '@/lib/strings';

export const dynamic = 'force-dynamic';

export default async function ChoresPage() {
  const s = await requireSession();
  const hid = s.household.id;
  const mates = s.roommates.map((m, i) => ({ id: m.id, name: m.name, index: i, photoVersion: m.photoVersion }));

  const { rows, lastBy, tally } = await choresWithHistory(db, hid, mates.map((m) => m.id));

  const now = new Date();
  const enriched = rows.map((c) => {
    const last = lastBy.get(c.id);
    const chore: Chore = {
      id: c.id, name: c.name, periodDays: c.periodDays, groupSize: c.groupSize,
      order: c.order.length ? c.order : mates.map((m) => m.id),
      lastDoneAt: last?.doneAt ?? null,
      lastDoneBy: last?.memberId ?? null,
    };
    return { row: c, chore, st: choreState(chore, now) };
  });

  const mine = enriched.filter((e) => e.st.assignees.includes(s.member.id));

  return (
    <>
      {mine.length > 0 && (
        <Card>
          <Eyebrow>{t.chores.yourTurn}</Eyebrow>
          <div className="flex flex-col">
            {mine.map((e) => (
              <ChoreRow key={e.row.id} id={e.row.id} name={e.row.name} st={e.st} mates={mates} meId={s.member.id} />
            ))}
          </div>
        </Card>
      )}

      <AddChore mates={mates} />

      <Card>
        <Eyebrow>{t.chores.title}</Eyebrow>
        {enriched.length === 0 ? (
          <Empty>{t.chores.empty}</Empty>
        ) : (
          <div className="flex flex-col">
            {enriched.map((e) => (
              <ChoreRow key={e.row.id} id={e.row.id} name={e.row.name} st={e.st} mates={mates} meId={s.member.id} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>{t.chores.tally}</Eyebrow>
        <div className="flex flex-col">
          {mates.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
              <Avatar name={m.name} index={m.index} size={26} memberId={m.id} photoVersion={m.photoVersion} />
              <span className="min-w-0 flex-1 truncate text-[14px]">{m.name}</span>
              <span className="num text-[14px]">{tally.get(m.id) ?? 0} {t.chores.times}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
