import { db } from '@/db';
import { requireSession } from '@/lib/session';
import { householdBalances, recentPurchases, itemsWithEvents } from '@/lib/queries';
import { stockState, buySoon } from '@/lib/stock';
import { nextRentDate } from '@/lib/rent';
import { splitEqual } from '@/lib/money';
import { settle, money } from '@/lib/money';
import { Avatar, Card, Eyebrow, Empty, Dot } from '@/components/ui';
import { AddPurchase, type ShelfItem } from './AddPurchase';
import { SettleButton } from './SettleButton';
import { PurchaseRow } from './PurchaseRow';
import { t } from '@/lib/strings';

export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 30;

export default async function ZakupPage() {
  const s = await requireSession();
  const hid = s.household.id;
  const idx = new Map(s.roommates.map((m, i) => [m.id, i]));
  const nameOf = (id: string) => s.roommates.find((m) => m.id === id)?.name ?? '—';

  const bal = await householdBalances(db, hid, s.roommates.map((m) => m.id));
  const transfers = settle(bal);
  const allSquare = transfers.length === 0;

  const { rows: recent, sharesBy, itemsBy } = await recentPurchases(db, hid, HISTORY_LIMIT);

  // Полка нужна прямо здесь: закуп должен предлагать то, что кончается,
  // а не заставлять вспоминать это по дороге в магазин.
  const { rows: itemRows, eventsBy } = await itemsWithEvents(db, hid, 12);
  const now = new Date();
  const shelf: ShelfItem[] = itemRows
    .filter((r) => r.ownerId === null || r.ownerId === s.member.id)
    .map((r) => ({
      id: r.id, name: r.name, unit: r.unit, price: r.price ?? null, packQty: r.packQty ?? null,
      needed: buySoon(stockState(eventsBy.get(r.id) ?? [], r.checkIntervalDays, now), 3),
    }));
  const toBuy = shelf.filter((i) => i.needed);

  const rentDue = nextRentDate(s.household.rentDay, now);
  const rentShare = s.household.rentAmount > 0
    ? splitEqual(s.household.rentAmount, s.roommates.length)[0]
    : 0;

  const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });

  return (
    <>
      <Card>
        <Eyebrow>{t.money.title}</Eyebrow>
        {allSquare ? (
          <p className="py-2 text-[15px]">{t.money.balanceZero}</p>
        ) : (
          <div className="flex flex-col">
            {s.roommates.map((m, i) => {
              const v = bal.get(m.id) ?? 0;
              if (v === 0) return null;
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                  <Avatar name={m.name} index={i} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {m.name}{m.id === s.member.id ? ` (${t.common.you})` : ''}
                  </span>
                  <span className="text-right">
                    <span className="num block text-[15px] font-medium">{money(Math.abs(v))}</span>
                    <span className="block text-[11.5px] text-ink-3">
                      {v > 0 ? t.money.owedThem : t.money.theyOwe}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {!allSquare && (
        <Card>
          <Eyebrow>{t.money.settleUp}</Eyebrow>
          <div className="flex flex-col gap-2">
            {transfers.map((tr) => (
              <div key={`${tr.from}-${tr.to}`} className="flex items-center gap-2.5">
                <Dot index={idx.get(tr.from) ?? 0} />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">
                  {nameOf(tr.from)} → {nameOf(tr.to)}
                </span>
                <span className="num text-[14px] font-medium">{money(tr.amount)}</span>
                <SettleButton from={tr.from} to={tr.to} amount={tr.amount}
                  canConfirm={tr.to === s.member.id} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-3">{t.money.settleHint}</p>
        </Card>
      )}

      {rentDue && rentShare > 0 && rentDue.daysLeft <= 7 && (
        <Card>
          <Eyebrow>{t.house.rent}</Eyebrow>
          <p className="text-[15px]">
            {rentDue.daysLeft === 0
              ? t.house.rentToday
              : `${t.house.rentSoon} ${rentDue.daysLeft} ${t.chores.days}`}
          </p>
          <p className="num text-[12.5px] text-ink-2">
            {money(rentShare)} {t.house.rentPerPerson}
          </p>
        </Card>
      )}

      {toBuy.length > 0 && (
        <Card>
          <Eyebrow>{t.things.toBuy}</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {toBuy.map((i) => (
              <span key={i.id} className="rounded-md border border-attn-line bg-attn-bg px-2 py-1 text-[12.5px] text-attn">
                {i.name}
              </span>
            ))}
          </div>
          <p className="mt-2.5 text-[12px] text-ink-3">{t.things.toBuyHint}</p>
        </Card>
      )}

      <AddPurchase
        roommates={s.roommates.map((m, i) => ({ id: m.id, name: m.name, index: i }))}
        meId={s.member.id}
        shelf={shelf}
      />

      <Card>
        <Eyebrow>{t.money.history}</Eyebrow>
        {recent.length === 0 ? (
          <Empty>{t.money.empty}</Empty>
        ) : (
          <div className="flex flex-col">
            {recent.map((p) => {
              const sh = sharesBy.get(p.id) ?? [];
              const isSettlement = p.kind === 'settlement';
              const myShare = sh.find((x) => x.memberId === s.member.id)?.amount ?? 0;
              const inside = itemsBy.get(p.id) ?? [];
              return (
                <PurchaseRow key={p.id} id={p.id}
                  inside={inside.map((l) => `${l.name} · ${l.qty} ${l.unit}`)}>
                  <Avatar name={nameOf(p.payerId)} index={idx.get(p.payerId) ?? 0} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px]">
                      {isSettlement
                        ? `${nameOf(p.payerId)} → ${nameOf(sh[0]?.memberId ?? '')}`
                        : p.note || t.money.purchaseFallback}
                    </div>
                    <div className="num truncate text-[11.5px] text-ink-3">
                      {dateFmt.format(p.boughtAt)}
                      {isSettlement ? ` · ${t.money.settlement}` : ` · ${nameOf(p.payerId)}`}
                    </div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="num block text-[14px] font-medium">{money(p.total)}</span>
                    {myShare > 0 && !isSettlement && (
                      <span className="num block text-[11px] text-ink-3">
                        {t.money.yourShare} {money(myShare)}
                      </span>
                    )}
                  </span>
                </PurchaseRow>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
