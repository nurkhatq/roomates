/**
 * Проверка на настоящем Postgres — движок поднимается прямо в процессе теста,
 * никакого внешнего сервера не нужно. Гоняются те же самые запросы, что и на
 * страницах: агрегат балансов, оконная выборка событий и счётчик дежурств.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../db/schema';
import { households, members, purchases, purchaseShares, items, stockEvents, chores, choreEvents } from '../../db/schema';
import { householdBalances, recentPurchases, itemsWithEvents, choresWithHistory, type AnyDb } from '../queries';
import { balances, sharesEqual, settle, type Purchase } from '../money';
import { stockState } from '../stock';
import { choreState } from '../chores';

const DAY = 86_400_000;

async function freshDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  // Накатываются ВСЕ миграции по порядку: с одной первой тесты начнут врать,
  // как только схема поедет дальше.
  const dir = join(process.cwd(), 'drizzle');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(join(dir, file), 'utf8').split('--> statement-breakpoint')) {
      const s = stmt.trim();
      if (s) await client.exec(s);
    }
  }
  return db as unknown as AnyDb;
}

async function seedHouse(db: AnyDb) {
  const [house] = await db.insert(households)
    .values({ name: 'Хата', inviteCode: 'ABC123' }).returning();
  const names = ['Нурхат', 'Данияр', 'Асхат', 'Ерлан'];
  const mates = [];
  for (let i = 0; i < names.length; i++) {
    const [m] = await db.insert(members)
      .values({ householdId: house.id, name: names[i], color: `--p${i + 1}` }).returning();
    mates.push(m);
  }
  return { house, mates };
}

test('схема разворачивается и квартира с жильцами создаётся', async () => {
  const db = await freshDb();
  const { house, mates } = await seedHouse(db);
  assert.equal(mates.length, 4);
  assert.ok(house.id);
});

test('балансы из базы совпадают с чистым расчётом', async () => {
  const db = await freshDb();
  const { house, mates } = await seedHouse(db);
  const ids = mates.map((m) => m.id);

  const raw: { payer: string; total: number; on: string[] }[] = [
    { payer: ids[0], total: 18130, on: ids },
    { payer: ids[1], total: 6200, on: ids },
    { payer: ids[0], total: 1500, on: [ids[0], ids[3]] },
    { payer: ids[2], total: 777, on: ids },
  ];

  const pure: Purchase[] = [];
  for (const r of raw) {
    const shares = sharesEqual(r.total, r.on);
    const [row] = await db.insert(purchases).values({
      householdId: house.id, payerId: r.payer, total: r.total, createdBy: ids[0],
    }).returning({ id: purchases.id });
    await db.insert(purchaseShares).values(
      shares.map((sh) => ({ purchaseId: row.id, memberId: sh.userId, amount: sh.amount })),
    );
    pure.push({ id: row.id, payerId: r.payer, total: r.total, shares });
  }

  const fromDb = await householdBalances(db, house.id, ids);
  const fromPure = balances(pure, ids);
  for (const id of ids) {
    assert.equal(fromDb.get(id), fromPure.get(id), `баланс ${id} разошёлся`);
  }
  assert.equal([...fromDb.values()].reduce((a, b) => a + b, 0), 0, 'сумма балансов не ноль');
});

test('погашение долга обнуляет балансы', async () => {
  const db = await freshDb();
  const { house, mates } = await seedHouse(db);
  const ids = mates.map((m) => m.id);

  const shares = sharesEqual(4000, [ids[0], ids[1]]);
  const [p] = await db.insert(purchases).values({
    householdId: house.id, payerId: ids[0], total: 4000, createdBy: ids[0],
  }).returning({ id: purchases.id });
  await db.insert(purchaseShares).values(
    shares.map((sh) => ({ purchaseId: p.id, memberId: sh.userId, amount: sh.amount })),
  );

  const before = await householdBalances(db, house.id, ids);
  const transfers = settle(before);
  assert.deepEqual(transfers, [{ from: ids[1], to: ids[0], amount: 2000 }]);

  // так это записывает действие recordSettlement
  for (const tr of transfers) {
    const [row] = await db.insert(purchases).values({
      householdId: house.id, kind: 'settlement', payerId: tr.from, total: tr.amount, createdBy: tr.from,
    }).returning({ id: purchases.id });
    await db.insert(purchaseShares).values({ purchaseId: row.id, memberId: tr.to, amount: tr.amount });
  }

  const after = await householdBalances(db, house.id, ids);
  assert.deepEqual(settle(after), [], 'после перевода долгов быть не должно');
});

test('история отдаёт покупки с долями, новые сверху', async () => {
  const db = await freshDb();
  const { house, mates } = await seedHouse(db);
  const ids = mates.map((m) => m.id);

  for (let i = 0; i < 5; i++) {
    const shares = sharesEqual(1000 * (i + 1), ids);
    const [row] = await db.insert(purchases).values({
      householdId: house.id, payerId: ids[i % 4], total: 1000 * (i + 1),
      note: `закуп ${i}`, boughtAt: new Date(Date.now() - i * DAY), createdBy: ids[0],
    }).returning({ id: purchases.id });
    await db.insert(purchaseShares).values(
      shares.map((sh) => ({ purchaseId: row.id, memberId: sh.userId, amount: sh.amount })),
    );
  }

  const { rows, sharesBy } = await recentPurchases(db, house.id, 3);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].note, 'закуп 0', 'сортировка не по свежести');
  assert.equal(sharesBy.get(rows[0].id)?.length, 4, 'доли не подтянулись');
});

test('оконный запрос отдаёт только последние события и расход считается верно', async () => {
  const db = await freshDb();
  const { house, mates } = await seedHouse(db);
  const me = mates[0].id;

  const [paper] = await db.insert(items).values({
    householdId: house.id, name: 'Туалетная бумага', unit: 'рулон', checkIntervalDays: 7,
  }).returning();
  const [soap] = await db.insert(items).values({
    householdId: house.id, name: 'Мыло', unit: 'шт', checkIntervalDays: 30,
  }).returning();

  const now = new Date();
  const ago = (d: number) => new Date(now.getTime() - d * DAY);

  // 20 событий по бумаге — оконный запрос обязан отдать только последние 12
  for (let i = 20; i >= 1; i--) {
    await db.insert(stockEvents).values({ itemId: paper.id, kind: 'check', qty: i, at: ago(i), memberId: me });
  }
  await db.insert(stockEvents).values({ itemId: soap.id, kind: 'purchase', qty: 4, at: ago(3), memberId: me });

  const { rows, eventsBy } = await itemsWithEvents(db, house.id, 12);
  assert.equal(rows.length, 2);
  assert.equal(eventsBy.get(paper.id)?.length, 12, 'окно не ограничило выборку');
  assert.equal(eventsBy.get(soap.id)?.length, 1, 'события чужой вещи попали не туда');

  // по бумаге остаток падает на 1 в день — расход должен получиться 1/день
  const st = stockState(eventsBy.get(paper.id)!, paper.checkIntervalDays, now);
  assert.equal(st.current, 1);
  assert.ok(st.ratePerDay !== null && Math.abs(st.ratePerDay - 1) < 0.001, `расход ${st.ratePerDay}`);
  assert.equal(st.confidence, 'good');

  // мыло ни разу не считали — расхода нет, но остаток известен
  const st2 = stockState(eventsBy.get(soap.id)!, soap.checkIntervalDays, now);
  assert.equal(st2.current, 4);
  assert.equal(st2.ratePerDay, null);
});

test('архивная вещь в выборку не попадает', async () => {
  const db = await freshDb();
  const { house } = await seedHouse(db);
  await db.insert(items).values({ householdId: house.id, name: 'Старое', archivedAt: new Date() });
  const { rows } = await itemsWithEvents(db, house.id, 12);
  assert.equal(rows.length, 0);
});

test('дежурства: последнее выполнение, очередь и счётчик', async () => {
  const db = await freshDb();
  const { house, mates } = await seedHouse(db);
  const ids = mates.map((m) => m.id);

  const [vac] = await db.insert(chores).values({
    householdId: house.id, name: 'Пылесос', periodDays: 7, order: ids,
  }).returning();

  const now = new Date();
  await db.insert(choreEvents).values([
    { choreId: vac.id, memberId: ids[0], doneAt: new Date(now.getTime() - 21 * DAY) },
    { choreId: vac.id, memberId: ids[1], doneAt: new Date(now.getTime() - 14 * DAY) },
    { choreId: vac.id, memberId: ids[0], doneAt: new Date(now.getTime() - 9 * DAY) },
  ]);

  const { rows, lastBy, tally } = await choresWithHistory(db, house.id, ids);
  assert.equal(rows.length, 1);

  const last = lastBy.get(vac.id)!;
  assert.equal(last.memberId, ids[0], 'взято не последнее выполнение');

  assert.equal(tally.get(ids[0]), 2);
  assert.equal(tally.get(ids[1]), 1);
  assert.equal(tally.get(ids[2]), 0, 'кто не делал — должен быть нулём, а не отсутствовать');

  const st = choreState({
    id: vac.id, name: rows[0].name, periodDays: rows[0].periodDays,
    groupSize: rows[0].groupSize, order: rows[0].order,
    lastDoneAt: last.doneAt, lastDoneBy: last.memberId,
  }, now);
  assert.equal(st.assignee, ids[1], 'очередь должна перейти следующему по кругу');
  assert.deepEqual(st.assignees, [ids[1]], 'дело на одного — один человек в очереди');
  assert.ok(st.daysSince !== null && Math.abs(st.daysSince - 9) < 0.01);
});

test('квартиры не видят данные друг друга', async () => {
  const db = await freshDb();
  const a = await seedHouse(db);
  const [houseB] = await db.insert(households).values({ name: 'Чужая', inviteCode: 'ZZZ999' }).returning();
  const [mateB] = await db.insert(members).values({ householdId: houseB.id, name: 'Чужой', color: '--p1' }).returning();

  await db.insert(purchases).values({
    householdId: houseB.id, payerId: mateB.id, total: 999999, createdBy: mateB.id,
  });
  await db.insert(items).values({ householdId: houseB.id, name: 'Чужая вещь' });

  const bal = await householdBalances(db, a.house.id, a.mates.map((m) => m.id));
  assert.equal([...bal.values()].reduce((x, y) => x + Math.abs(y), 0), 0, 'чужие траты просочились');

  const { rows } = await itemsWithEvents(db, a.house.id, 12);
  assert.equal(rows.length, 0, 'чужие вещи просочились');
});
