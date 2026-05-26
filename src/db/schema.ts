import { mysqlTable, varchar, int, timestamp, text, boolean, bigint, mysqlEnum, datetime } from 'drizzle-orm/mysql-core';

export const uploadedImages = mysqlTable('uploaded_images', {
  id: varchar('id', { length: 36 }).primaryKey(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: int('size').notNull(), // final processed size in bytes
  originalSize: int('original_size').notNull(), // original size in bytes
  width: int('width').notNull(),
  height: int('height').notNull(),
  format: varchar('format', { length: 20 }).notNull(),
  quality: int('quality').notNull(),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  bucket: varchar('bucket', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export type UploadedImage = typeof uploadedImages.$inferSelect;
export type NewUploadedImage = typeof uploadedImages.$inferInsert;

export const settings = mysqlTable('settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at'),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export const fcmTokens = mysqlTable('fcm_tokens', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 36 }).notNull().unique(),
  fcmToken: text('fcm_token'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export type FcmToken = typeof fcmTokens.$inferSelect;
export type NewFcmToken = typeof fcmTokens.$inferInsert;

export const notifications = mysqlTable('notifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: text('user_id'),
  fcmToken: text('fcm_token'),
  title: varchar('title', { length: 255 }),
  body: text('body'),
  type: mysqlEnum('type', ['broadcast', 'payment_status']).default('broadcast').notNull(),
  image: text('image'),
  scheduledAt: timestamp('scheduled_at').defaultNow().notNull(),
  isMulticast: boolean('is_multicast').default(false).notNull(),
  read: boolean('read').default(false).notNull(),
  status: mysqlEnum('status', ['pending', 'sent', 'failed']).default('pending').notNull(),
  url: varchar('url', { length: 255 }),
  screen: varchar('screen', { length: 255 }),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;


