import test from 'node:test';
import assert from 'node:assert/strict';
import { todayISO, partsTZ, noonTZ, daysBetween, fmtDayTime, momentFor } from '../time';

/* Тесты гоняются в поясе машины разработчика, но сервер живёт в UTC.
   Здесь важно, что результат не зависит от пояса процесса. */

test('время показывается по Астане, а не по серверу', () => {
  // 02:24 UTC — это 07:24 в Астане
  assert.match(fmtDayTime.format(new Date('2026-08-31T02:24:00Z')), /07:24/);
});

test('поздний вечер в Астане — это уже следующий день, хотя в UTC ещё нет', () => {
  // 20:30 UTC 31 августа = 01:30 первого сентября в Астане
  const late = new Date('2026-08-31T20:30:00Z');
  assert.deepEqual(partsTZ(late), { year: 2026, month: 9, day: 1 });
  assert.equal(todayISO(late), '2026-09-01');
});

test('раннее утро по Астане ещё вчерашний день по UTC', () => {
  // 01:00 первого сентября в Астане = 20:00 31 августа UTC
  const early = new Date('2026-08-31T20:00:00Z');
  assert.equal(todayISO(early), '2026-09-01');
});

test('дата без времени становится полднем по Астане', () => {
  const d = noonTZ('2026-08-31');
  assert.equal(d.toISOString(), '2026-08-31T07:00:00.000Z');
  assert.equal(todayISO(d), '2026-08-31', 'день не должен уехать');
});

test('разница в сутках считается по календарю Астаны', () => {
  const a = new Date('2026-08-31T20:30:00Z'); // 1 сентября в Астане
  const b = new Date('2026-09-01T20:30:00Z'); // 2 сентября в Астане
  assert.equal(daysBetween(a, b), 1);
  assert.equal(daysBetween(a, a), 0);
});

test('закуп за сегодня получает настоящее время, а не полдень', () => {
  const now = new Date('2026-08-31T02:24:00Z'); // 07:24 в Астане
  assert.equal(momentFor('2026-08-31', now).toISOString(), now.toISOString());
});

test('закуп задним числом получает полдень того дня', () => {
  const now = new Date('2026-08-31T02:24:00Z');
  assert.equal(momentFor('2026-08-29', now).toISOString(), '2026-08-29T07:00:00.000Z');
});

test('поздним вечером «сегодня» — это уже завтрашняя дата', () => {
  const late = new Date('2026-08-31T20:30:00Z'); // 01:30 первого сентября в Астане
  assert.equal(momentFor('2026-09-01', late).toISOString(), late.toISOString(),
    'выбранное «сегодня» должно совпасть с календарём Астаны');
});
