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
