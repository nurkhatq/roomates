import { db } from '@/db';
import { requireSession } from '@/lib/session';
import { itemsWithEvents } from '@/lib/queries';
import { stockState, checkDue, buySoon } from '@/lib/stock';
import { Card, Eyebrow, Empty, Attn } from '@/components/ui';
import { AddItem } from './AddItem';
import { ItemCard, type CardItem } from './ItemCard';
import { t } from '@/lib/strings';

export const dynamic = 'force-dynamic';

/** Для расчёта расхода нужны последние замеры, а не вся история вещи. */
const EVENTS_PER_ITEM = 12;

export default async function VeshiPage() {
  const s = await requireSession();
  const { rows, eventsBy } = await itemsWithEvents(db, s.household.id, EVENTS_PER_ITEM);

  const now = new Date();
  const mine = (ownerId: string | null) => ownerId === null || ownerId === s.member.id;

  const cards = rows
    .filter((r) => mine(r.ownerId))
    .map((r) => {
      const st = stockState(eventsBy.get(r.id) ?? [], r.checkIntervalDays, now);
      const due = checkDue(st, now);
      const low = buySoon(st, 3);
      return {
        item: {
          id: r.id, name: r.name, unit: r.unit, ownerId: r.ownerId,
          checkIntervalDays: r.checkIntervalDays, price: r.price ?? null,
          hasPhoto: Boolean(r.hasPhoto), photoVersion: Number(r.photoVersion) || 0,
        } satisfies CardItem,
        st,
        flag: due ? ('check' as const) : low ? ('buy' as const) : null,
        // Что требует внимания — вперёд, дальше по алфавиту как пришло из базы
        rank: due ? 0 : low ? 1 : 2,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const needAttention = cards.filter((c) => c.flag !== null).length;
  const unlogged = cards.filter((c) => c.st.unloggedPurchases > 0).length;
  const mates = s.roommates.map((m, i) => ({ id: m.id, name: m.name, index: i }));

  return (
    <>
      {unlogged > 0 && <Attn>{t.things.unlogged}</Attn>}

      <AddItem mates={mates} meId={s.member.id} />

      {/* Плитки лежат прямо на фоне страницы: карточка внутри карточки давала
          вторую рамку вокруг каждой вещи. */}
      <Eyebrow>{t.things.shelf}</Eyebrow>
      {cards.length === 0 ? (
        <Card><Empty>{t.things.empty}</Empty></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cards.map((c) => (
              <ItemCard key={c.item.id} item={c.item} st={c.st} flag={c.flag} mates={mates} />
            ))}
          </div>
          {needAttention > 0 && (
            <p className="mt-3 text-[12px] text-ink-3">{t.things.needCheckHint}</p>
          )}
        </>
      )}
    </>
  );
}
