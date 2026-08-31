'use client';

/**
 * Подготовка фото вещи прямо на телефоне: убрать фон, ужать, отдать WebP.
 *
 * Библиотека удаления фона тянется с CDN отдельным модулем, а не пакетом из
 * node_modules — её веса весят десятки мегабайт и в сборку на бесплатном
 * тарифе Vercel не влезут. Если CDN недоступен, фото сохраняется как есть:
 * лучше карточка с обычным снимком, чем ошибка на пустом месте.
 */
const BG_LIB = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const MAX_SIDE = 512;

export type PhotoResult = { dataUrl: string; bgRemoved: boolean };

export async function prepPhoto(file: File, removeBg: boolean): Promise<PhotoResult> {
  let source: Blob = file;
  let bgRemoved = false;

  if (removeBg) {
    try {
      const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ BG_LIB);
      source = await mod.removeBackground(file);
      bgRemoved = true;
    } catch {
      source = file; // CDN недоступен или формат не поддержан — работаем с оригиналом
    }
  }

  return { dataUrl: await shrink(source), bgRemoved };
}

async function shrink(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Браузер не дал холст для обработки фото');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL('image/webp', 0.8);
}
