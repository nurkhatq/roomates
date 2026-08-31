import test from 'node:test';
import assert from 'node:assert/strict';
import { choreState, tally, type Chore } from '../chores';

const DAY = 86_400_000;
const NOW = new Date('2026-09-01T12:00:00Z');
const ORDER = ['a', 'b', 'c', 'd'];
const base: Chore = { id: '1', name: 'Пылесос', periodDays: 7, groupSize: 1, order: ORDER, lastDoneAt: null, lastDoneBy: null };

test('никто ещё не делал — очередь первого', () => {
  const s = choreState(base, NOW);
  assert.equal(s.assignee, 'a');
  assert.equal(s.daysSince, null);
});

test('очередь идёт по кругу и возвращается к первому', () => {
  let last = 'a';
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) {
    const s = choreState({ ...base, lastDoneBy: last, lastDoneAt: NOW }, NOW);
    seen.push(s.assignee!);
    last = s.assignee!;
  }
  assert.deepEqual(seen, ['b', 'c', 'd', 'a', 'b']);
});

test('человек съехал из квартиры — очередь не ломается', () => {
  const s = choreState({ ...base, lastDoneBy: 'кто-то-съехавший', lastDoneAt: NOW }, NOW);
  assert.equal(s.assignee, 'a');
});

test('срок считается от последнего раза', () => {
  const s = choreState({ ...base, lastDoneAt: new Date(NOW.getTime() - 9 * DAY), lastDoneBy: 'a' }, NOW);
  assert.equal(s.daysSince, 9);
  assert.equal(s.daysUntilDue, -2); // срок был два дня назад
  assert.equal(s.assignee, 'b');
});

test('счётчик считает всех, включая тех, кто ни разу', () => {
  const t = tally([{ userId: 'a' }, { userId: 'a' }, { userId: 'c' }], ORDER);
  assert.deepEqual([...t.entries()], [['a', 2], ['b', 0], ['c', 1], ['d', 0]]);
});

test('дело на двоих отдаёт двух человек подряд', () => {
  const s = choreState({ ...base, groupSize: 2, lastDoneBy: 'a', lastDoneAt: NOW }, NOW);
  assert.deepEqual(s.assignees, ['b', 'c']);
  assert.equal(s.assignee, 'b', 'первый из пары остаётся «главным»');
});

test('очередь на двоих идёт по кругу и заворачивается через конец списка', () => {
  const s = choreState({ ...base, groupSize: 2, lastDoneBy: 'd', lastDoneAt: NOW }, NOW);
  assert.deepEqual(s.assignees, ['a', 'b']);
  const s2 = choreState({ ...base, groupSize: 3, lastDoneBy: 'c', lastDoneAt: NOW }, NOW);
  assert.deepEqual(s2.assignees, ['d', 'a', 'b']);
});

test('людей просят не больше, чем есть в квартире', () => {
  const s = choreState({ ...base, groupSize: 10, lastDoneBy: null, lastDoneAt: null }, NOW);
  assert.equal(s.assignees.length, ORDER.length);
  assert.deepEqual(new Set(s.assignees).size, ORDER.length, 'один человек не должен попасть дважды');
});

test('дело на одного ведёт себя как раньше', () => {
  const s = choreState({ ...base, lastDoneBy: 'b', lastDoneAt: NOW }, NOW);
  assert.deepEqual(s.assignees, ['c']);
});
