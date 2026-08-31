import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Пароль жильца.
 *
 * Код квартиры пускает в дом — его знают все и пересылают в чате. Пароль
 * отвечает за то, что ты это ты: без него любой, кому попала ссылка, заходит
 * под чужим именем и подтверждает переводы за него.
 *
 * scrypt из стандартной библиотеки: медленный по задумке, поэтому перебор
 * дорогой, и никакой лишней зависимости в проект тащить не надо.
 *
 * Пометки server-only здесь намеренно нет: модуль чистый, его импортируют
 * только серверные действия, зато его можно прогнать тестами.
 */
const KEYLEN = 64;
const SALT_LEN = 16;

export const MIN_PASSWORD = 4;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password.normalize('NFKC'), salt, KEYLEN);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, saltB64, keyB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(keyB64, 'base64');
  if (expected.length !== KEYLEN) return false;

  const actual = scryptSync(password.normalize('NFKC'), salt, KEYLEN);
  // Сравнение постоянного времени: обычное === выдаёт длину совпадающего
  // префикса по времени ответа и помогает подбирать пароль побайтово.
  return timingSafeEqual(actual, expected);
}

/** Что не так с паролем, или null, если всё в порядке. */
export function passwordProblem(password: string): string | null {
  const p = password.trim();
  if (p.length < MIN_PASSWORD) return `Пароль короче ${MIN_PASSWORD} знаков`;
  if (p.length > 200) return 'Пароль слишком длинный';
  return null;
}
