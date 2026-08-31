/**
 * Единицы измерения. Список закрытый, но чужое значение не теряется: если у
 * вещи стоит что-то своё, оно добавляется в выбор — иначе при первом же
 * сохранении единица молча заменилась бы на «шт».
 */
export const UNITS = ['шт', 'рулон', 'пачка', 'бутылка', 'упаковка', 'л', 'мл', 'кг', 'г'] as const;

export function unitOptions(current?: string | null): string[] {
  const list = [...UNITS] as string[];
  const c = (current ?? '').trim();
  return c && !list.includes(c) ? [c, ...list] : list;
}
