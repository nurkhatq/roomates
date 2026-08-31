/**
 * Обрезка вырезанного предмета по его собственным краям.
 *
 * После удаления фона от исходного кадра остаётся прозрачное поле: на замерах
 * реальных фото предмет занимал 15–22% площади и сидел не по центру. На плитке
 * это выглядит как мелкий болтающийся объект. Здесь мы находим границы
 * непрозрачных пикселей, обрезаем по ним, добавляем ровные поля и кладём в
 * квадрат — тогда все вещи на полке одного размера и по центру.
 *
 * Модуль намеренно без импортов и только на браузерных API: его же код
 * прогоняется по уже загруженным фото при починке старых карточек.
 */

export type TrimOptions = {
  /** Ограничение на большую сторону результата. Меньше исходника не растягиваем. */
  maxSide?: number;
  /** Поля вокруг предмета, доля от его большей стороны. */
  pad?: number;
  /** Ниже этого значения альфа считается прозрачной. */
  alphaThreshold?: number;
  /** Какую долю «веса» картинки разрешено отрезать с каждой стороны как мусор. */
  noiseFraction?: number;
};

/** Границы непрозрачной части. null — предмета не нашли. */
export function alphaBounds(
  data: Uint8ClampedArray, w: number, h: number, threshold: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * Границы предмета по весу пикселей, а не по крайнему найденному.
 *
 * Удаление фона оставляет одиночные полупрозрачные точки далеко от предмета.
 * Поиск по крайнему непрозрачному пикселю растягивал рамку до такой точки, и
 * сам предмет из-за этого ужимался вдвое. Здесь считается сумма альфы по
 * строкам и столбцам, и с краёв отбрасывается доля общего веса: точка в
 * несколько пикселей весит ничтожно мало и отсекается, а предмет — нет.
 */
export function massBounds(
  data: Uint8ClampedArray, w: number, h: number, threshold: number, noiseFraction: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const cols = new Float64Array(w);
  const rows = new Float64Array(h);
  let total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a <= threshold) continue;
      cols[x] += a; rows[y] += a; total += a;
    }
  }
  if (total === 0) return null;

  const limit = total * noiseFraction;
  const scan = (arr: Float64Array, len: number): [number, number] => {
    let acc = 0, lo = 0, hi = len - 1;
    while (lo < len && acc + arr[lo] <= limit) { acc += arr[lo]; lo++; }
    acc = 0;
    while (hi >= 0 && acc + arr[hi] <= limit) { acc += arr[hi]; hi--; }
    return lo <= hi ? [lo, hi] : [0, len - 1];
  };
  const [x0, x1] = scan(cols, w);
  const [y0, y1] = scan(rows, h);
  return { x0, y0, x1, y1 };
}

/**
 * Обрезает картинку по самому предмету, сохраняя его пропорции.
 *
 * Квадрат тут намеренно не делается: вписывать вытянутую коробку в квадрат
 * значит запекать в файл прозрачные поля, из-за которых предмет на плитке
 * выглядит мелким. Пусть каждая вещь остаётся своей формы — тогда на полке
 * она занимает столько места, сколько может.
 */
export function trimToContent(
  bitmap: ImageBitmap | HTMLImageElement,
  { maxSide = 512, pad = 0.02, alphaThreshold = 8, noiseFraction = 0.002 }: TrimOptions = {},
): HTMLCanvasElement {
  const sw = bitmap.width;
  const sh = bitmap.height;

  // Границы ищем на уменьшенной копии: у снимка с телефона двенадцать
  // миллионов пикселей, и перебирать их все незачем — рамка нужна с точностью
  // до пары пикселей. Обрезка потом делается из оригинала, без потери резкости.
  const proxySide = 320;
  const pScale = Math.min(1, proxySide / Math.max(sw, sh));
  const pw = Math.max(1, Math.round(sw * pScale));
  const ph = Math.max(1, Math.round(sh * pScale));

  const proxy = document.createElement('canvas');
  proxy.width = pw; proxy.height = ph;
  const pctx = proxy.getContext('2d', { willReadFrequently: true });
  if (!pctx) throw new Error('Браузер не дал холст для обработки фото');
  pctx.drawImage(bitmap as CanvasImageSource, 0, 0, pw, ph);

  const b = massBounds(pctx.getImageData(0, 0, pw, ph).data, pw, ph, alphaThreshold, noiseFraction);

  const box = b
    ? { x: b.x0 / pScale, y: b.y0 / pScale,
        w: (b.x1 - b.x0 + 1) / pScale, h: (b.y1 - b.y0 + 1) / pScale }
    : { x: 0, y: 0, w: sw, h: sh };

  // Небольшие поля, чтобы не срезать сглаженный край предмета.
  const padPx = Math.max(box.w, box.h) * pad;
  const cx = Math.max(0, box.x - padPx);
  const cy = Math.max(0, box.y - padPx);
  const cw = Math.min(sw - cx, box.w + padPx * 2);
  const ch = Math.min(sh - cy, box.h + padPx * 2);

  // Никогда не растягиваем сверх исходника — это только мылит картинку.
  const scale = Math.min(1, maxSide / Math.max(cw, ch));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cw * scale));
  out.height = Math.max(1, Math.round(ch * scale));
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Браузер не дал холст для обработки фото');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap as CanvasImageSource, cx, cy, cw, ch, 0, 0, out.width, out.height);
  return out;
}

export function encode(canvas: HTMLCanvasElement, quality = 0.85): { dataUrl: string; mime: string } {
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) return { dataUrl: webp, mime: 'image/webp' };
  return { dataUrl: canvas.toDataURL('image/png'), mime: 'image/png' };
}
