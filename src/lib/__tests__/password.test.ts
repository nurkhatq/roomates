import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, passwordProblem } from '../password';

test('правильный пароль принимается, неправильный — нет', () => {
  const h = hashPassword('нурхат2026');
  assert.equal(verifyPassword('нурхат2026', h), true);
  assert.equal(verifyPassword('нурхат2025', h), false);
  assert.equal(verifyPassword('', h), false);
});

test('один и тот же пароль каждый раз хешируется по-разному', () => {
  const a = hashPassword('одинаковый');
  const b = hashPassword('одинаковый');
  assert.notEqual(a, b, 'соль должна быть своя у каждого');
  assert.equal(verifyPassword('одинаковый', a), true);
  assert.equal(verifyPassword('одинаковый', b), true);
});

test('в хеше не видно самого пароля', () => {
  const h = hashPassword('секретнаяфраза');
  assert.ok(!h.includes('секретнаяфраза'));
  assert.match(h, /^scrypt\$/);
});

test('без пароля вход невозможен', () => {
  assert.equal(verifyPassword('что угодно', null), false);
  assert.equal(verifyPassword('что угодно', 'мусор'), false);
  assert.equal(verifyPassword('что угодно', 'scrypt$abc'), false);
});

test('кириллица в разной раскладке юникода — это один пароль', () => {
  // «й» можно записать одним знаком или как «и» с краткой сверху
  const h = hashPassword('мойпароль');
  assert.equal(verifyPassword('мойпароль', h), true);
});

test('слишком короткий пароль не пропускается', () => {
  assert.ok(passwordProblem('абв'));
  assert.equal(passwordProblem('абвг'), null);
  assert.ok(passwordProblem('я'.repeat(250)));
});
