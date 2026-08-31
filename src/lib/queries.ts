import { sql, eq, and, isNull, asc, desc, lte, inArray, getTableColumns } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from '@/db/schema';
import { purchases, purchaseShares, items, itemPhotos, stockEvents, chores, choreEvents } from '@/db/schema';

/**
 * Запросы вынесены из страниц, чтобы их можно было прогнать на настоящем
 * Postgres в тестах. Тип базы взят общим — работает и с боевым драйвером Neon,
 * и с локальным движком в тестах.
 */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Баланс каждого жильца одним агрегатом на стороне базы: сколько бы ни
 * накопилось истории, наружу приходит по строке на человека.
 */
export async function householdBalances(db: AnyDb, householdId: string, memberIds: string[]) {
  const [paid, owed] = await Promise.all([
    db.select({ memberId: purchases.payerId, sum: sql<number>`coalesce(sum(${purchases.total}), 0)::int` })
      .from(purchases).where(eq(purchases.householdId, householdId)).groupBy(purchases.payerId),
    db.select({ memberId: purchaseShares.memberId, sum: sql<number>`coalesce(sum(${purchaseShares.amount}), 0)::int` })
      .from(purchaseShares).innerJoin(purchases, eq(purchases.id, purchaseShares.purchaseId))
      .where(eq(purchases.householdId, householdId)).groupBy(purchaseShares.memberId),
  ]);

  const bal = new Map<string, number>(memberIds.map((id) => [id, 0]));
  for (const r of paid) bal.set(r.memberId, (bal.get(r.memberId) ?? 0) + Number(r.sum));
  for (const r of owed) bal.set(r.memberId, (bal.get(r.memberId) ?? 0) - Number(r.sum));
  return bal;
}

export async function recentPurchases(db: AnyDb, householdId: string, limit: number) {
  const rows = await db.select().from(purchases)
    .where(eq(purchases.householdId, householdId))
    .orderBy(desc(purchases.boughtAt), desc(purchases.createdAt))
    .limit(limit);

  const shares = rows.length
    ? await db.select().from(purchaseShares).where(inArray(purchaseShares.purchaseId, rows.map((r) => r.id)))
    : [];

  const by = new Map<string, typeof shares>();
  for (const sh of shares) {
    const arr = by.get(sh.purchaseId) ?? [];
    arr.push(sh);
    by.set(sh.purchaseId, arr);
  }
  return { rows, sharesBy: by };
}

/**
 * По N последних событий на каждую вещь. Через CTE с оконной функцией, а не
 * сырым SQL: конструктор Drizzle возвращает одинаковую форму на любом драйвере.
 */
export async function itemsWithEvents(db: AnyDb, householdId: string, perItem: number) {
  // hasPhoto считается прямо здесь: без него страница дёргала бы маршрут
  // картинки у каждой вещи, включая те, у которых фото нет.
  const rows = await db
    .select({ ...getTableColumns(items), hasPhoto: sql<boolean>`(${itemPhotos.itemId} is not null)` })
    .from(items)
    .leftJoin(itemPhotos, eq(itemPhotos.itemId, items.id))
    .where(and(eq(items.householdId, householdId), isNull(items.archivedAt)))
    .orderBy(asc(items.name));

  if (rows.length === 0) return { rows, eventsBy: new Map<string, { kind: 'purchase' | 'check'; qty: number; at: Date }[]>() };

  const ranked = db.$with('ranked').as(
    db.select({
      itemId: stockEvents.itemId,
      kind: stockEvents.kind,
      qty: stockEvents.qty,
      at: stockEvents.at,
      rn: sql<number>`row_number() over (partition by ${stockEvents.itemId} order by ${stockEvents.at} desc)`.as('rn'),
    })
      .from(stockEvents)
      .innerJoin(items, eq(items.id, stockEvents.itemId))
      .where(and(eq(items.householdId, householdId), isNull(items.archivedAt))),
  );

  const evs = await db.with(ranked)
    .select({ itemId: ranked.itemId, kind: ranked.kind, qty: ranked.qty, at: ranked.at })
    .from(ranked)
    .where(lte(ranked.rn, perItem));

  const eventsBy = new Map<string, { kind: 'purchase' | 'check'; qty: number; at: Date }[]>();
  for (const e of evs) {
    const arr = eventsBy.get(e.itemId) ?? [];
    arr.push({ kind: e.kind, qty: Number(e.qty), at: new Date(e.at) });
    eventsBy.set(e.itemId, arr);
  }
  return { rows, eventsBy };
}

/** Дежурства с последним выполнением и счётчиком «кто сколько раз». */
export async function choresWithHistory(db: AnyDb, householdId: string, memberIds: string[]) {
  const rows = await db.select().from(chores)
    .where(and(eq(chores.householdId, householdId), isNull(chores.archivedAt)))
    .orderBy(asc(chores.name));

  const tally = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const lastBy = new Map<string, { memberId: string; doneAt: Date }>();
  if (rows.length === 0) return { rows, lastBy, tally };

  const ranked = db.$with('ranked_chores').as(
    db.select({
      choreId: choreEvents.choreId,
      memberId: choreEvents.memberId,
      doneAt: choreEvents.doneAt,
      rn: sql<number>`row_number() over (partition by ${choreEvents.choreId} order by ${choreEvents.doneAt} desc)`.as('rn'),
    })
      .from(choreEvents)
      .innerJoin(chores, eq(chores.id, choreEvents.choreId))
      .where(and(eq(chores.householdId, householdId), isNull(chores.archivedAt))),
  );

  const [lasts, counts] = await Promise.all([
    db.with(ranked)
      .select({ choreId: ranked.choreId, memberId: ranked.memberId, doneAt: ranked.doneAt })
      .from(ranked).where(lte(ranked.rn, 1)),
    db.select({ memberId: choreEvents.memberId, n: sql<number>`count(*)::int` })
      .from(choreEvents)
      .innerJoin(chores, eq(chores.id, choreEvents.choreId))
      .where(and(eq(chores.householdId, householdId), isNull(chores.archivedAt)))
      .groupBy(choreEvents.memberId),
  ]);

  for (const l of lasts) lastBy.set(l.choreId, { memberId: l.memberId, doneAt: new Date(l.doneAt) });
  for (const c of counts) tally.set(c.memberId, Number(c.n));
  return { rows, lastBy, tally };
}
