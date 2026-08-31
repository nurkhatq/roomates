import { db } from '@/db';
import { requireSession } from '@/lib/session';
import { itemsWithEvents } from '@/lib/queries';
import { stockState, checkDue, buySoon } from '@/lib/stock';
import { Card, Eyebrow, Empty, Attn } from '@/components/ui';
import { AddItem } from './AddItem';
import { ItemRow } from './ItemRow';
import { t } from '@/lib/strings';

export const dynamic = 'force-dynamic';

/** Для расчёта расхода нужны последние замеры, а не вся история вещи. */
const EVENTS_PER_ITEM = 12;

export default async function VeshiPage() {
  const s = await requireSession();
  const hid = s.household.id;

  const { rows, eventsBy } = await itemsWithEvents(db, hid, EVENTS_PER_ITEM);

  const now = new Date();
  const enriched = rows.map((it) => {
    const st = stockState(eventsBy.get(it.id) ?? [], it.checkIntervalDays, now);
    return { item: it, st, due: checkDue(st, now), low: buySoon(st, 3) };
  });

  const mine = (id: string | null) => id === null || id === s.member.id;
  const visible = enriched.filter((e) => mine(e.item.ownerId));
  const due = visible.filter((e) => e.due);
  const low = visible.filter((e) => e.low && !e.due);
  const rest = visible.filter((e) => !e.due && !e.low);
  const unlogged = visible.filter((e) => e.st.unloggedPurchases > 0).length;

  const mates = s.roommates.map((m, i) => ({ id: m.id, name: m.name, index: i }));

  return (
    <>
      {unlogged > 0 && <Attn>{t.things.unlogged}</Attn>}

      {due.length > 0 && (
        <Card>
          <Eyebrow>{t.things.needCheck}</Eyebrow>
          <div className="flex flex-col">
            {due.map((e) => <ItemRow key={e.item.id} item={e.item} st={e.st} highlight="check" mates={mates} />)}
          </div>
          <p className="mt-3 text-[12px] text-ink-3">{t.things.needCheckHint}</p>
        </Card>
      )}

      {low.length > 0 && (
        <Card>
          <Eyebrow>{t.things.runningOut}</Eyebrow>
          <div className="flex flex-col">
            {low.map((e) => <ItemRow key={e.item.id} item={e.item} st={e.st} highlight="buy" mates={mates} />)}
          </div>
        </Card>
      )}

      <AddItem mates={mates} meId={s.member.id} />

      <Card>
        <Eyebrow>{t.things.all}</Eyebrow>
        {visible.length === 0 ? (
          <Empty>{t.things.empty}</Empty>
        ) : (
          <div className="flex flex-col">
            {rest.map((e) => <ItemRow key={e.item.id} item={e.item} st={e.st} mates={mates} />)}
            {rest.length === 0 && <Empty>Всё разобрано выше.</Empty>}
          </div>
        )}
      </Card>
    </>
  );
}
