'use client';

import { trimToContent, squareCrop, resizeTo, encode } from './trim';

/**
 * Подготовка фото на телефоне. Три разных случая, и путать их нельзя:
 *
 * - `cutout` — вещь: убрать фон, обрезать по предмету, сохранить прозрачность;
 * - `square` — аватарка: квадрат из середины кадра, фон не трогаем, иначе от
 *   человека остался бы силуэт;
 * - `plain`  — квартира и чек: просто ужать, ничего не вырезая. Чеку нужен
 *   размер побольше, иначе цифры не прочитать.
 *
 * Библиотека удаления фона тянется с CDN отдельным модулем, а не пакетом из
 * node_modules — её веса весят десятки мегабайт и в сборку на бесплатном
 * тарифе Vercel не влезут. Если CDN недоступен, фото сохраняется как есть.
 */
const BG_LIB = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';

export type PhotoMode = 'cutout' | 'square' | 'plain';
export type PhotoResult = { dataUrl: string; mime: string; bgRemoved: boolean };

const MAX_SIDE: Record<PhotoMode, number> = { cutout: 512, square: 512, plain: 1024 };
const QUALITY: Record<PhotoMode, number> = { cutout: 0.85, square: 0.82, plain: 0.72 };

export async function prepPhoto(file: File, mode: PhotoMode): Promise<PhotoResult> {
  let source: Blob = file;
  let bgRemoved = false;

  if (mode === 'cutout') {
    try {
      const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ BG_LIB);
      source = await mod.removeBackground(file);
      bgRemoved = true;
    } catch {
      source = file; // CDN недоступен или формат не поддержан — работаем с оригиналом
    }
  }

  const bitmap = await createImageBitmap(source);
  try {
    const size = MAX_SIDE[mode];
    const canvas =
      mode === 'cutout' ? trimToContent(bitmap, { maxSide: size })
      : mode === 'square' ? squareCrop(bitmap, size)
      : resizeTo(bitmap, size);
    const { dataUrl, mime } = encode(canvas, QUALITY[mode], mode === 'cutout');
    return { dataUrl, mime, bgRemoved };
  } finally {
    bitmap.close();
  }
}
