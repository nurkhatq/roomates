import test from 'node:test';
import assert from 'node:assert/strict';
import { alphaBounds } from '../trim';

/** Собирает картинку w×h, где непрозрачен только заданный прямоугольник. */
function make(w: number, h: number, box: { x0: number; y0: number; x1: number; y1: number } | null) {
  const d = new Uint8ClampedArray(w * h * 4);
  if (box) {
    for (let y = box.y0; y <= box.y1; y++) {
      for (let x = box.x0; x <= box.x1; x++) d[(y * w + x) * 4 + 3] = 255;
    }
  }
  return d;
}

test('находит границы предмета в прозрачном поле', () => {
  const box = { x0: 12, y0: 30, x1: 40, y1: 55 };
  assert.deepEqual(alphaBounds(make(64, 80, box), 64, 80, 8), box);
});

test('полностью прозрачная картинка — предмета нет', () => {
  assert.equal(alphaBounds(make(20, 20, null), 20, 20, 8), null);
});

test('предмет во всю картинку — границы по краям', () => {
  const box = { x0: 0, y0: 0, x1: 9, y1: 9 };
  assert.deepEqual(alphaBounds(make(10, 10, box), 10, 10, 8), box);
});

test('еле заметная дымка не считается предметом', () => {
  const d = new Uint8ClampedArray(10 * 10 * 4);
  for (let i = 0; i < 100; i++) d[i * 4 + 3] = 5;      // мусор от вырезания
  d[(5 * 10 + 5) * 4 + 3] = 200;                        // настоящий пиксель
  assert.deepEqual(alphaBounds(d, 10, 10, 8), { x0: 5, y0: 5, x1: 5, y1: 5 });
});

test('один пиксель на краю не теряется', () => {
  const d = new Uint8ClampedArray(8 * 8 * 4);
  d[(7 * 8 + 7) * 4 + 3] = 255;
  assert.deepEqual(alphaBounds(d, 8, 8, 8), { x0: 7, y0: 7, x1: 7, y1: 7 });
});

import { massBounds } from '../trim';

/** Картинка с предметом и отдельной точкой-мусором в углу. */
function withSpeck(w: number, h: number) {
  const d = new Uint8ClampedArray(w * h * 4);
  // предмет: плотный прямоугольник в нижней половине
  for (let y = 40; y <= 90; y++) for (let x = 20; x <= 60; x++) d[(y * w + x) * 4 + 3] = 255;
  // мусор: две точки у верхнего края, как оставляет удаление фона
  d[(2 * w + 5) * 4 + 3] = 120;
  d[(3 * w + 6) * 4 + 3] = 90;
  return d;
}

test('одиночная точка мусора не растягивает рамку', () => {
  const d = withSpeck(80, 100);
  const naive = alphaBounds(d, 80, 100, 8);
  const mass = massBounds(d, 80, 100, 8, 0.002);
  assert.equal(naive!.y0, 2, 'поиск по крайнему пикселю ловит мусор — так и было');
  assert.equal(mass!.y0, 40, 'по весу рамка должна начинаться с самого предмета');
  assert.deepEqual(mass, { x0: 20, y0: 40, x1: 60, y1: 90 });
});

test('предмет целиком не обрезается, когда мусора нет', () => {
  const d = new Uint8ClampedArray(50 * 50 * 4);
  for (let y = 10; y <= 39; y++) for (let x = 5; x <= 44; x++) d[(y * 50 + x) * 4 + 3] = 255;
  assert.deepEqual(massBounds(d, 50, 50, 8, 0.002), { x0: 5, y0: 10, x1: 44, y1: 39 });
});

test('пустая картинка — границ нет', () => {
  assert.equal(massBounds(new Uint8ClampedArray(10 * 10 * 4), 10, 10, 8, 0.002), null);
});

test('тонкий выступ предмета не отрезается как мусор', () => {
  const w = 60, h = 100;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 30; y <= 90; y++) for (let x = 15; x <= 45; x++) d[(y * w + x) * 4 + 3] = 255; // корпус
  for (let y = 10; y <= 29; y++) for (let x = 28; x <= 32; x++) d[(y * w + x) * 4 + 3] = 255; // носик
  const b = massBounds(d, w, h, 8, 0.002)!;
  assert.equal(b.y0, 10, 'носик флакона — часть предмета, а не мусор');
});
