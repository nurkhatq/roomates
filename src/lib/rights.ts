/**
 * Кто что может. Чистые правила без базы и серверных импортов — чтобы их
 * можно было прогнать тестами и использовать в одном и том же виде и на
 * сервере при проверке, и в интерфейсе при показе кнопок.
 */

export type PurchaseLike = { kind: string; payerId: string; createdBy: string };

/**
 * Удалить запись может только тот, кого она касается.
 *
 * Закуп — заплативший или тот, кто его записал: свою опечатку человек должен
 * уметь исправить. Перевод — только две его стороны: иначе посторонний жилец
 * отменяет чужое подтверждение оплаты, и погашенный долг воскресает.
 */
export function canDeletePurchase(
  p: PurchaseLike, shareMemberIds: string[], meId: string,
): boolean {
  if (p.payerId === meId || p.createdBy === meId) return true;
  return p.kind === 'settlement' && shareMemberIds.includes(meId);
}

/** Подтвердить перевод может только получатель — деньги пришли ему. */
export function canConfirmSettlement(toId: string, meId: string): boolean {
  return toId === meId;
}

/** Личную вещь трогает только владелец; общую — любой жилец. */
export function canEditItem(ownerId: string | null, meId: string): boolean {
  return ownerId === null || ownerId === meId;
}
