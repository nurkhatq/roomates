import test from 'node:test';
import assert from 'node:assert/strict';
import { splitEqual, sharesEqual, balances, settle, type Purchase } from '../money';

const [A, B, C, D] = ['a', 'b', 'c', 'd'];
const ALL = [A, B, C, D];

test('делёж не теряет и не создаёт тенге', () => {
  for (const total of [18130, 1, 3, 999999, 0, 4000]) {
    for (const n of [1, 2, 3, 4, 7]) {
      const parts = splitEqual(total, n);
      assert.equal(parts.length, n);
      assert.equal(parts.reduce((a, b) => a + b, 0), total, `${total} на ${n}`);
      assert.ok(Math.max(...parts) - Math.min(...parts) <= 1, 'части расходятся больше чем на тенге');
    }
  }
});

test('реальный случай: 18130 на четверых', () => {
  const parts = splitEqual(18130, 4);
  assert.deepEqual(parts, [4533, 4533, 4532, 4532]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 18130);
});

test('баланс всегда сходится в ноль', () => {
  const purchases: Purchase[] = [
    { id: '1', payerId: A, total: 18130, shares: sharesEqual(18130, ALL) },
    { id: '2', payerId: B, total: 4500, shares: sharesEqual(4500, [B, C]) },
    { id: '3', payerId: C, total: 777, shares: sharesEqual(777, ALL) },
  ];
  const bal = balances(purchases, ALL);
  assert.equal([...bal.values()].reduce((a, b) => a + b, 0), 0);
  // A заплатил 18130, а начислено ему 4533 своей покупки и 195 от покупки C
  assert.equal(bal.get(A), 18130 - 4533 - 195);
});

test('переводы гасят все долги и их не больше трёх на четверых', () => {
  const purchases: Purchase[] = [
    { id: '1', payerId: A, total: 18130, shares: sharesEqual(18130, ALL) },
    { id: '2', payerId: B, total: 6200, shares: sharesEqual(6200, ALL) },
    { id: '3', payerId: A, total: 1500, shares: sharesEqual(1500, [A, D]) },
  ];
  const bal = balances(purchases, ALL);
  const transfers = settle(bal);
  assert.ok(transfers.length <= ALL.length - 1, `переводов ${transfers.length}`);

  const after = new Map(bal);
  for (const t of transfers) {
    after.set(t.from, (after.get(t.from) ?? 0) + t.amount);
    after.set(t.to, (after.get(t.to) ?? 0) - t.amount);
  }
  for (const [u, v] of after) assert.equal(v, 0, `у ${u} осталось ${v}`);
  assert.ok(transfers.every((t) => t.amount > 0), 'нулевых переводов быть не должно');
});

test('когда все в расчёте — переводов нет', () => {
  const purchases: Purchase[] = [
    { id: '1', payerId: A, total: 4000, shares: sharesEqual(4000, [A, B]) },
    { id: '2', payerId: B, total: 4000, shares: sharesEqual(4000, [A, B]) },
  ];
  assert.deepEqual(settle(balances(purchases, [A, B])), []);
});
