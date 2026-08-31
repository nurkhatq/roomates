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
