import test from 'node:test';
import assert from 'node:assert/strict';
import { stockState, checkDue, buySoon, type StockEvent } from '../stock';

const DAY = 86_400_000;
const NOW = new Date('2026-09-01T12:00:00Z');
const ago = (d: number) => new Date(NOW.getTime() - d * DAY);

test('без событий система молчит и ничего не выдумывает', () => {
  const s = stockState([], 7, NOW);
  assert.equal(s.current, null);
  assert.equal(s.ratePerDay, null);
  assert.equal(s.nextCheckOn, null);
  assert.equal(s.confidence, 'none');
});

test('купили блок — знаем остаток, но расход ещё не знаем', () => {
  const ev: StockEvent[] = [{ kind: 'purchase', qty: 12, at: ago(2) }];
  const s = stockState(ev, 7, NOW);
  assert.equal(s.current, 12);
  assert.equal(s.ratePerDay, null);
  assert.equal(s.confidence, 'none');
  // срок пересчёта — ровно тот, что поставили руками
  assert.equal(s.nextCheckOn?.getTime(), ago(2).getTime() + 7 * DAY);
});

test('первый пересчёт даёт расход: 12 рулонов, через 7 дней осталось 5', () => {
  const ev: StockEvent[] = [
    { kind: 'purchase', qty: 12, at: ago(14) },
    { kind: 'check', qty: 12, at: ago(14) },
    { kind: 'check', qty: 5, at: ago(7) },
  ];
  const s = stockState(ev, 7, NOW);
  assert.equal(s.current, 5);
  assert.equal(s.ratePerDay, 1); // 7 штук за 7 дней
  assert.equal(s.confidence, 'rough');
  assert.equal(s.daysLeft, 5);
});

test('второй пересчёт уточняет расход и повышает доверие', () => {
  const ev: StockEvent[] = [
    { kind: 'check', qty: 12, at: ago(21) },
    { kind: 'check', qty: 5, at: ago(14) },  // 1/день
    { kind: 'check', qty: 1, at: ago(7) },   // 0.571/день, вес больше
  ];
  const s = stockState(ev, 7, NOW);
  assert.equal(s.confidence, 'good');
  assert.ok(s.ratePerDay !== null && s.ratePerDay > 0.6 && s.ratePerDay < 0.8,
    `расход ${s.ratePerDay}`);
});

test('докупили между проверками — расход считается с учётом закупки', () => {
  const ev: StockEvent[] = [
    { kind: 'check', qty: 2, at: ago(10) },
    { kind: 'purchase', qty: 12, at: ago(9) },
    { kind: 'check', qty: 4, at: ago(0) },   // израсходовано 2+12-4 = 10 за 10 дней
  ];
  const s = stockState(ev, 7, NOW);
  assert.equal(s.ratePerDay, 1);
  assert.equal(s.current, 4);
});

test('остаток вырос без записанной закупки — замер выкидывается, а не ломает расчёт', () => {
  const ev: StockEvent[] = [
    { kind: 'check', qty: 3, at: ago(10) },
    { kind: 'check', qty: 9, at: ago(5) },   // кто-то купил и не записал
    { kind: 'check', qty: 4, at: ago(0) },
  ];
  const s = stockState(ev, 7, NOW);
  assert.equal(s.unloggedPurchases, 1);
  assert.equal(s.confidence, 'rough');       // остался один годный замер
  assert.equal(s.ratePerDay, 1);             // 9 → 4 за 5 дней
});

test('система не просит пересчёт чаще чем раз в двое суток и не реже своего срока', () => {
  const ev: StockEvent[] = [
    { kind: 'check', qty: 100, at: ago(2) },
    { kind: 'check', qty: 1, at: NOW },      // расход бешеный
  ];
  const s = stockState(ev, 14, NOW);
  const gap = (s.nextCheckOn!.getTime() - NOW.getTime()) / DAY;
  assert.ok(gap >= 2, `просит через ${gap} дней — слишком часто`);
  assert.ok(gap <= 14, `просит через ${gap} дней — позже собственного срока`);
});

test('пересчёт назначается сам, когда расход известен', () => {
  const ev: StockEvent[] = [
    { kind: 'purchase', qty: 30, at: ago(20) },
    { kind: 'check', qty: 30, at: ago(20) },
    { kind: 'check', qty: 20, at: ago(10) }, // 1/день, осталось 20
  ];
  const s = stockState(ev, 30, NOW);
  // порог «мало» = 30% от пачки 30 = 9 штук; сейчас 20, расход 1/день → ~11 дней
  const gap = (s.nextCheckOn!.getTime() - NOW.getTime()) / DAY;
  assert.ok(gap > 9 && gap < 13, `назначил через ${gap} дней`);
  assert.equal(checkDue(s, NOW), false);
});

test('пора закупаться, когда кончается на днях', () => {
  const ev: StockEvent[] = [
    { kind: 'check', qty: 10, at: ago(7) },
    { kind: 'check', qty: 2, at: NOW },
  ];
  const s = stockState(ev, 7, NOW);
  assert.ok(buySoon(s, 3), `дней осталось ${s.daysLeft}`);
  assert.equal(buySoon(stockState([{ kind: 'purchase', qty: 50, at: ago(1) }], 7, NOW), 3), false);
});

test('полным запасом считается самая большая разовая закупка', () => {
  const ev: StockEvent[] = [
    { kind: 'purchase', qty: 12, at: ago(20) },
    { kind: 'purchase', qty: 4, at: ago(10) },
    { kind: 'check', qty: 6, at: ago(1) },
  ];
  const s = stockState(ev, 7, NOW);
  assert.equal(s.capacity, 12);
  assert.equal(s.level, 0.5);
});

test('вещь просто завели и описали — полка считается полной', () => {
  // Тот, кто добавил вещь, её не покупал. Но 10 рулонов на полке — это и есть
  // полная полка, иначе у такой вещи вообще не было бы уровня.
  const s = stockState([{ kind: 'check', qty: 10, at: ago(1) }], 7, NOW);
  assert.equal(s.capacity, 10);
  assert.equal(s.level, 1);
});

test('совсем без событий уровня нет', () => {
  const s = stockState([], 7, NOW);
  assert.equal(s.capacity, null);
  assert.equal(s.level, null);
});

test('полной считается самая полная полка, какую видели', () => {
  // Описали 3, потом докупили 12 — на полке побывало 15, это и есть потолок.
  const s = stockState([
    { kind: 'check', qty: 3, at: ago(10) },
    { kind: 'purchase', qty: 12, at: ago(9) },
    { kind: 'check', qty: 15, at: ago(9) },
    { kind: 'check', qty: 4, at: ago(1) },
  ], 7, NOW);
  assert.equal(s.capacity, 15);
  assert.ok(s.level !== null && Math.abs(s.level - 4 / 15) < 0.001);
});

test('пустая вещь попадает в закуп даже без известного расхода', () => {
  const s = stockState([
    { kind: 'purchase', qty: 10, at: ago(9) },
    { kind: 'check', qty: 0, at: ago(1) },
  ], 7, NOW);
  assert.equal(s.ratePerDay, null, 'расход тут посчитать не из чего');
  assert.equal(buySoon(s), true);
});

test('меньше трети пачки — тоже в закуп', () => {
  const s = stockState([
    { kind: 'purchase', qty: 12, at: ago(5) },
    { kind: 'check', qty: 3, at: ago(1) },
  ], 7, NOW);
  assert.ok(s.level !== null && s.level < 0.3);
  assert.equal(buySoon(s), true);
});

test('полная полка в закуп не просится', () => {
  const s = stockState([{ kind: 'purchase', qty: 12, at: ago(1) }], 7, NOW);
  assert.equal(s.level, 1);
  assert.equal(buySoon(s), false);
});

test('два пересчёта подряд не превращаются в бешеный расход', () => {
  // Ровно то, что случилось вживую: 400 г пересчитали в 0 через 41 минуту.
  // Без порога выходило 13 900 г в день, и вещь навсегда висела в закупе.
  const ev: StockEvent[] = [
    { kind: 'check', qty: 400, at: new Date(NOW.getTime() - 2 * DAY) },
    { kind: 'check', qty: 0, at: new Date(NOW.getTime() - 2 * DAY + 41 * 60000) },
    { kind: 'purchase', qty: 400, at: ago(1) },
  ];
  const s = stockState(ev, 30, NOW);
  assert.equal(s.ratePerDay, null, 'замер за 41 минуту считать нельзя');
  assert.equal(s.current, 400);
  assert.equal(buySoon(s), false, 'после закупа вещь обязана уйти из списка');
});

test('нормальный замер за несколько дней по-прежнему считается', () => {
  const ev: StockEvent[] = [
    { kind: 'check', qty: 400, at: ago(10) },
    { kind: 'check', qty: 200, at: ago(5) },
  ];
  const s = stockState(ev, 30, NOW);
  assert.equal(s.ratePerDay, 40);
});

test('замер ровно в полсуток уже годится', () => {
  const ev: StockEvent[] = [
    { kind: 'check', qty: 10, at: new Date(NOW.getTime() - 1.5 * DAY) },
    { kind: 'check', qty: 5, at: new Date(NOW.getTime() - 1.0 * DAY) },
  ];
  const s = stockState(ev, 7, NOW);
  assert.equal(s.ratePerDay, 10);
});
