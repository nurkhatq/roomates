import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRentDate } from '../rent';

test('день ещё не наступил — платёж в этом месяце', () => {
  const r = nextRentDate(5, new Date(2026, 8, 2))!;
  assert.equal(r.date.getDate(), 5);
  assert.equal(r.date.getMonth(), 8);
  assert.equal(r.daysLeft, 3);
});

test('сегодня и есть день платежа', () => {
  const r = nextRentDate(5, new Date(2026, 8, 5))!;
  assert.equal(r.daysLeft, 0);
});

test('день прошёл — считаем следующий месяц', () => {
  const r = nextRentDate(5, new Date(2026, 8, 20))!;
  assert.equal(r.date.getMonth(), 9);
  assert.equal(r.daysLeft, 15);
});

test('31-е число в коротком месяце не уезжает на следующий', () => {
  const r = nextRentDate(31, new Date(2027, 1, 10))!; // февраль 2027
  assert.equal(r.date.getMonth(), 1, 'должен остаться февралём');
  assert.equal(r.date.getDate(), 28);
});

test('день не задан — напоминать не о чем', () => {
  assert.equal(nextRentDate(null), null);
  assert.equal(nextRentDate(0), null);
  assert.equal(nextRentDate(45), null);
});
