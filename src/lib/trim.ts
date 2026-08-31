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
  /** Сторона итогового квадрата. */
  size?: number;
  /** Поля вокруг предмета, доля от его большей стороны. */
  pad?: number;
  /** Ниже этого значения альфа считается прозрачной. */
  alphaThreshold?: number;
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

export function trimToSquare(
  bitmap: ImageBitmap | HTMLImageElement,
  { size = 512, pad = 0.08, alphaThreshold = 8 }: TrimOptions = {},
): HTMLCanvasElement {
  const sw = 'width' in bitmap ? bitmap.width : 0;
  const sh = 'height' in bitmap ? bitmap.height : 0;

  // Границы ищем на уменьшенной копии: у снимка с телефона двенадцать
  // миллионов пикселей, и перебирать их все незачем — рамка нужна с точностью
  // до пары пикселей. Сама обрезка потом делается из оригинала, без потери резкости.
  const proxySide = 256;
  const pScale = Math.min(1, proxySide / Math.max(sw, sh));
  const pw = Math.max(1, Math.round(sw * pScale));
  const ph = Math.max(1, Math.round(sh * pScale));

  const proxy = document.createElement('canvas');
  proxy.width = pw; proxy.height = ph;
  const pctx = proxy.getContext('2d', { willReadFrequently: true });
  if (!pctx) throw new Error('Браузер не дал холст для обработки фото');
  pctx.drawImage(bitmap as CanvasImageSource, 0, 0, pw, ph);

  const bounds = alphaBounds(pctx.getImageData(0, 0, pw, ph).data, pw, ph, alphaThreshold);

  // Фон не удалялся или предмет не нашёлся — берём кадр целиком, но всё равно
  // приводим к квадрату, чтобы карточки не прыгали.
  const box = bounds
    ? { x: bounds.x0 / pScale, y: bounds.y0 / pScale,
        w: (bounds.x1 - bounds.x0 + 1) / pScale, h: (bounds.y1 - bounds.y0 + 1) / pScale }
    : { x: 0, y: 0, w: sw, h: sh };

  const side = Math.max(box.w, box.h) * (1 + pad * 2);
  const scale = size / side;
  const dw = box.w * scale;
  const dh = box.h * scale;

  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Браузер не дал холст для обработки фото');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap as CanvasImageSource,
    box.x, box.y, box.w, box.h,
    (size - dw) / 2, (size - dh) / 2, dw, dh,
  );
  return out;
}

/**
 * WebP умеет не каждый браузер: старые Safari молча отдают PNG, из-за чего
 * файлы выходят втрое тяжелее. Возвращаем то, что получилось на самом деле.
 */
export function encode(canvas: HTMLCanvasElement, quality = 0.85): { dataUrl: string; mime: string } {
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) return { dataUrl: webp, mime: 'image/webp' };
  return { dataUrl: canvas.toDataURL('image/png'), mime: 'image/png' };
}
