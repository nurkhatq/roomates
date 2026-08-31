/**
 * Цвета жильцов. Набор не подбирался на глаз: из 70 сочетаний проверенных
 * слотов только два проходят валидатор на ВСЕХ парах сразу в обеих темах —
 * а жильцы стоят рядом в произвольном порядке, значит важны именно все пары.
 * Менять эти четыре цвета без повторной проверки нельзя.
 */
export const PERSON_VARS = ['--p1', '--p2', '--p3', '--p4'] as const;

/** Цвет по порядку появления жильца в квартире. Пятому и дальше — по кругу. */
export function personVar(index: number): string {
  return PERSON_VARS[index % PERSON_VARS.length];
}

/** Инициалы: одна буква имени, две — если имя из двух слов. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
