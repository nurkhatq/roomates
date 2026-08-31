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

test('поздним вечером по Астане счёт идёт уже от следующего дня', () => {
  // 20:30 UTC 4 сентября = 01:30 пятого сентября в Астане, платёж пятого
  const late = new Date('2026-09-04T20:30:00Z');
  const r = nextRentDate(5, late)!;
  assert.equal(r.daysLeft, 0, 'по Астане это уже день платежа');
});

test('до платежа считается по календарю, а не по часам', () => {
  const r = nextRentDate(5, new Date('2026-09-01T19:00:00Z'))!; // 2 сентября 00:00 в Астане
  assert.equal(r.daysLeft, 3);
});
