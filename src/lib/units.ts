/**
 * Единицы измерения.
 *
 * Основная — то, что кончается и что легко пересчитать глазами: рулоны,
 * бутылки, банки, штуки. Вторая — то, чем покупают: упаковка, лоток, килограмм.
 *
 * Списки закрытые, но чужое значение не теряется: если у вещи стоит что-то
 * своё, оно добавляется в выбор — иначе при первом же сохранении единица
 * молча заменилась бы на «шт».
 */
export const DEFAULT_UNIT = 'шт';

/** В чём считаем на полке. */
export const UNITS = [
  'шт', 'рулон', 'бутылка', 'банка', 'пачка', 'упаковка', 'л', 'мл', 'кг', 'г',
] as const;

/** Чем берут в магазине. */
export const ALT_UNITS = [
  'упаковка', 'лоток', 'коробка', 'блок', 'мешок', 'пачка', 'бутылка', 'кг', 'л',
] as const;

function withCurrent(list: readonly string[], current?: string | null): string[] {
  const out = [...list];
  const c = (current ?? '').trim();
  return c && !out.includes(c) ? [c, ...out] : out;
}

export const unitOptions = (current?: string | null) => withCurrent(UNITS, current);
export const altUnitOptions = (current?: string | null) => withCurrent(ALT_UNITS, current);
