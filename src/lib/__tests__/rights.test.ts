import test from 'node:test';
import assert from 'node:assert/strict';
import { canDeletePurchase, canConfirmSettlement, canEditItem } from '../rights';

const [NURKHAT, ERNAZAR, ARNUR, RAUAN] = ['n', 'e', 'a', 'r'];

test('закуп удаляет тот, кто платил', () => {
  const p = { kind: 'purchase', payerId: ERNAZAR, createdBy: ERNAZAR };
  assert.equal(canDeletePurchase(p, [NURKHAT, ERNAZAR, ARNUR, RAUAN], ERNAZAR), true);
});

test('закуп удаляет и тот, кто его записал за другого', () => {
  const p = { kind: 'purchase', payerId: ERNAZAR, createdBy: NURKHAT };
  assert.equal(canDeletePurchase(p, [NURKHAT, ERNAZAR], NURKHAT), true);
});

test('посторонний жилец чужой закуп не удалит, даже если скидывался', () => {
  const p = { kind: 'purchase', payerId: ERNAZAR, createdBy: ERNAZAR };
  assert.equal(canDeletePurchase(p, [NURKHAT, ERNAZAR, ARNUR, RAUAN], ARNUR), false);
});

test('перевод удаляют только его две стороны', () => {
  // Ерназар перевёл Рауану, Рауан подтвердил.
  const p = { kind: 'settlement', payerId: ERNAZAR, createdBy: RAUAN };
  assert.equal(canDeletePurchase(p, [RAUAN], ERNAZAR), true, 'плательщик');
  assert.equal(canDeletePurchase(p, [RAUAN], RAUAN), true, 'получатель');
  // Ровно тот случай, который нашёл Нурхат: посторонний отменял чужую оплату.
  assert.equal(canDeletePurchase(p, [RAUAN], NURKHAT), false, 'посторонний');
  assert.equal(canDeletePurchase(p, [RAUAN], ARNUR), false, 'ещё один посторонний');
});

test('получатель перевода удаляет его, даже если подтверждал не он', () => {
  const p = { kind: 'settlement', payerId: ERNAZAR, createdBy: ERNAZAR };
  assert.equal(canDeletePurchase(p, [RAUAN], RAUAN), true);
});

test('подтвердить перевод может только получатель', () => {
  assert.equal(canConfirmSettlement(RAUAN, RAUAN), true);
  assert.equal(canConfirmSettlement(RAUAN, ERNAZAR), false, 'плательщик не подтверждает за получателя');
  assert.equal(canConfirmSettlement(RAUAN, NURKHAT), false, 'посторонний тем более');
});

test('личную вещь трогает только владелец', () => {
  assert.equal(canEditItem(null, NURKHAT), true, 'общую — любой');
  assert.equal(canEditItem(ARNUR, ARNUR), true);
  assert.equal(canEditItem(ARNUR, NURKHAT), false);
});
