import { and, eq, isNull, asc } from 'drizzle-orm';
import { db, items } from '@/db';
import { requireSession } from '@/lib/session';
import { householdBalances, myActivity, photoVersions } from '@/lib/queries';
import { money } from '@/lib/money';
import { Card, Eyebrow, Empty, btnGhost } from '@/components/ui';
import { MyProfile } from './MyProfile';
import { t } from '@/lib/strings';

export const dynamic = 'force-dynamic';

const ACTIONS_LIMIT = 25;

export default async function MePage() {
  const s = await requireSession();
  const hid = s.household.id;

  const [bal, actions, versions, mine] = await Promise.all([
    householdBalances(db, hid, s.roommates.map((m) => m.id)),
    myActivity(db, hid, s.member.id, ACTIONS_LIMIT),
    photoVersions(db, hid, [s.member.id]),
    db.select().from(items)
      .where(and(eq(items.householdId, hid), eq(items.ownerId, s.member.id), isNull(items.archivedAt)))
      .orderBy(asc(items.name)),
  ]);

  const my = bal.get(s.member.id) ?? 0;
  const avatarV = versions.byMember.get(s.member.id) ?? null;
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <MyProfile
        name={s.member.name}
        memberId={s.member.id}
        photoVersion={avatarV}
        index={s.roommates.findIndex((m) => m.id === s.member.id)}
      />

      <Card>
        <Eyebrow>{t.money.title}</Eyebrow>
        <div className="num text-[26px] font-medium">{money(Math.abs(my))}</div>
        <div className="text-[12.5px] text-ink-2">
          {my > 0 ? t.me.balanceOwed : my < 0 ? t.me.balanceOwe : t.me.balanceZero}
        </div>
      </Card>

      <Card>
        <Eyebrow>{t.me.myThings}</Eyebrow>
        {mine.length === 0 ? (
          <Empty>{t.me.noMyThings}</Empty>
        ) : (
          <div className="flex flex-col">
            {mine.map((i) => (
              <div key={i.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className="min-w-0 flex-1 truncate text-[14px]">{i.name}</span>
                <span className="num shrink-0 text-[12px] text-ink-3">{i.unit}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2.5 text-[12px] text-ink-3">{t.me.myThingsHint}</p>
      </Card>

      <Card>
        <Eyebrow>{t.me.actions}</Eyebrow>
        {actions.length === 0 ? (
          <Empty>{t.me.noActions}</Empty>
        ) : (
          <div className="flex flex-col">
            {actions.map((a, i) => (
              <div key={`${a.kind}-${i}`} className="flex items-baseline gap-3 border-b border-line py-2 last:border-b-0">
                <span className="min-w-0 flex-1 truncate text-[13.5px]">
                  {a.kind === 'paid' && `${t.me.paid} · ${a.label}`}
                  {a.kind === 'chore' && `${t.me.didChore} · ${a.label}`}
                  {a.kind === 'stock' && `${a.check ? t.me.counted : t.me.restocked} · ${a.label}`}
                </span>
                <span className="num shrink-0 text-[12.5px] text-ink-2">
                  {a.kind === 'paid' ? money(a.amount) : a.kind === 'stock' ? `${a.qty} ${a.unit}` : ''}
                </span>
                <span className="num shrink-0 text-[11px] text-ink-3">{fmt.format(a.at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <a href="/dom" className={`${btnGhost} w-full`}>{t.house.title}</a>
      </Card>
    </>
  );
}
