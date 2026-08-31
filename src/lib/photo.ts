'use client';

import { trimToContent, encode } from './trim';

/**
 * Подготовка фото вещи прямо на телефоне: убрать фон, обрезать по краям
 * предмета, привести к квадрату и отдать картинку.
 *
 * Библиотека удаления фона тянется с CDN отдельным модулем, а не пакетом из
 * node_modules — её веса весят десятки мегабайт и в сборку на бесплатном
 * тарифе Vercel не влезут. Если CDN недоступен, фото сохраняется как есть:
 * лучше карточка с обычным снимком, чем ошибка на пустом месте.
 */
const BG_LIB = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const SIZE = 512;

export type PhotoResult = { dataUrl: string; mime: string; bgRemoved: boolean };

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

  const bitmap = await createImageBitmap(source);
  try {
    const canvas = trimToContent(bitmap, { maxSide: SIZE });
    const { dataUrl, mime } = encode(canvas);
    return { dataUrl, mime, bgRemoved };
  } finally {
    bitmap.close();
  }
}
