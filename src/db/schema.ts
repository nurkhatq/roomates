import {
  pgTable, text, integer, timestamp, uuid, doublePrecision,
  primaryKey, index, uniqueIndex, jsonb,
} from 'drizzle-orm/pg-core';

/* ------------------------------ квартира и жильцы ------------------------------ */

export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** Код, по которому руммейт заходит по ссылке. */
  inviteCode: text('invite_code').notNull(),
  /** Адрес как его пишут людям: «Улица Розы Баглановой, 1». */
  address: text('address').notNull().default(''),
  /** Ссылка на карту — по ней такси и гости находят дом быстрее, чем по адресу. */
  mapUrl: text('map_url').notNull().default(''),
  entrance: text('entrance').notNull().default(''),
  apartment: text('apartment').notNull().default(''),
  floor: text('floor').notNull().default(''),
  /** Аренда за месяц целиком, делится на всех жильцов. */
  rentAmount: integer('rent_amount').notNull().default(0),
  /** День месяца, когда платят. Пусто — не задано. */
  rentDay: integer('rent_day'),
  /** Коммуналка: сумма меняется, поэтому это лишь ориентир. */
  utilitiesAmount: integer('utilities_amount').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('households_invite_code_idx').on(t.inviteCode)]);

export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** Цвет кружка рядом с именем — чтобы различать в списках без фоток. */
  color: text('color').notNull(),
  /** Пусто сейчас; появится, когда прикрутим вход через Google. Схему менять не придётся. */
  oauthSub: text('oauth_sub'),
  leftAt: timestamp('left_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('members_household_idx').on(t.householdId)]);

export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [index('sessions_member_idx').on(t.memberId)]);

/* --------------------------------- закуп и долги -------------------------------- */

/**
 * Одна таблица на закупы и на погашения долга. Погашение — это тот же перевод
 * денег между людьми, просто с одним участником, поэтому баланс считается
 * одним и тем же кодом без частных случаев.
 */
export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['purchase', 'settlement'] }).notNull().default('purchase'),
  payerId: uuid('payer_id').notNull().references(() => members.id),
  /** Целые тенге. */
  total: integer('total').notNull(),
  note: text('note').notNull().default(''),
  boughtAt: timestamp('bought_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull().references(() => members.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('purchases_household_idx').on(t.householdId, t.boughtAt)]);

export const purchaseShares = pgTable('purchase_shares', {
  purchaseId: uuid('purchase_id').notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id),
  /** Целые тенге. Сумма долей всегда равна total покупки. */
  amount: integer('amount').notNull(),
}, (t) => [
  primaryKey({ columns: [t.purchaseId, t.memberId] }),
  index('purchase_shares_member_idx').on(t.memberId),
]);

/* ----------------------------------- вещи ------------------------------------ */

export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  /** Пусто — вещь общая. Заполнено — личная вещь этого жильца. */
  ownerId: uuid('owner_id').references(() => members.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** «рулон», «шт», «пачка» — в чём считаем. */
  unit: text('unit').notNull().default('шт'),
  /** Первый срок пересчёта, который ставят руками. Дальше система подбирает сама. */
  checkIntervalDays: integer('check_interval_days').notNull().default(7),
  /** Последняя известная цена за единицу. Обновляется при закупе. */
  price: integer('price'),
  /**
   * Вторая мера той же вещи и сколько в ней базовых единиц.
   *
   * Считаем всегда в основной единице — она кончается и её удобно пересчитать
   * глазами. Но покупают часто в другой: бумагу упаковками по 10 рулонов,
   * картошку килограммами. Вторая мера нужна, чтобы не умножать в уме:
   * «взял 3 кг» превращается в 24 штуки, а опись всё равно ведётся в штуках.
   */
  altUnit: text('alt_unit'),
  altQty: doublePrecision('alt_qty'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('items_household_idx').on(t.householdId)]);

/**
 * Фото отдельной таблицей: список вещей грузится десятки раз в день, и тащить
 * картинки в каждом таком запросе незачем. Отдаются отдельным маршрутом с кэшем.
 */
export const itemPhotos = pgTable('item_photos', {
  itemId: uuid('item_id').primaryKey().references(() => items.id, { onDelete: 'cascade' }),
  /** WebP без фона, base64, обрезанный по 512px на стороне телефона. */
  data: text('data').notNull(),
  mime: text('mime').notNull().default('image/webp'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stockEvents = pgTable('stock_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  /** purchase — докупили столько-то; check — пересчитали, осталось столько-то. */
  kind: text('kind', { enum: ['purchase', 'check'] }).notNull(),
  qty: doublePrecision('qty').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  memberId: uuid('member_id').notNull().references(() => members.id),
}, (t) => [index('stock_events_item_idx').on(t.itemId, t.at)]);

/* --------------------------------- дежурства --------------------------------- */

export const chores = pgTable('chores', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  periodDays: integer('period_days').notNull().default(7),
  /**
   * Сколько человек делают это вместе. Мусор выносит один, генералку —
   * вдвоём: очередь тогда берёт по двое подряд.
   */
  groupSize: integer('group_size').notNull().default(1),
  /** Очередь по кругу: массив id жильцов. */
  order: jsonb('order').$type<string[]>().notNull().default([]),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('chores_household_idx').on(t.householdId)]);

export const choreEvents = pgTable('chore_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  choreId: uuid('chore_id').notNull().references(() => chores.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id),
  doneAt: timestamp('done_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('chore_events_chore_idx').on(t.choreId, t.doneAt)]);

/* ------------------------------ фото людей и дома ------------------------------ */

/**
 * Аватарки и фото квартиры лежат отдельными таблицами, а не одной общей:
 * так у каждой сохраняется внешний ключ с каскадом, и осиротевших картинок
 * в базе не остаётся.
 */
export const memberPhotos = pgTable('member_photos', {
  memberId: uuid('member_id').primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  data: text('data').notNull(),
  mime: text('mime').notNull().default('image/webp'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const householdPhotos = pgTable('household_photos', {
  householdId: uuid('household_id').primaryKey().references(() => households.id, { onDelete: 'cascade' }),
  data: text('data').notNull(),
  mime: text('mime').notNull().default('image/webp'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* --------------------------- что именно купили в закуп -------------------------- */

/**
 * Строки закупа, привязанные к вещам с полки. Записал закуп — остаток вещи
 * пополнился сам, и цена запомнилась. Отдельно от purchase_shares: там про
 * то, кто скидывался, а здесь про то, что лежит в пакете.
 */
export const purchaseItems = pgTable('purchase_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseId: uuid('purchase_id').notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  /** Сколько единиц взяли. */
  qty: doublePrecision('qty').notNull(),
  /** Сколько отдали за эту позицию, целыми тенге. */
  amount: integer('amount').notNull().default(0),
}, (t) => [
  index('purchase_items_purchase_idx').on(t.purchaseId),
  index('purchase_items_item_idx').on(t.itemId),
]);
