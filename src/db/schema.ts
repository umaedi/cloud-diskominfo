import { mysqlTable, varchar, int, timestamp, text, boolean } from 'drizzle-orm/mysql-core';

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
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  fcmToken: text('fcm_token').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export type FcmToken = typeof fcmTokens.$inferSelect;
export type NewFcmToken = typeof fcmTokens.$inferInsert;

export const notifications = mysqlTable('notifications', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 255 }),
  fcmToken: text('fcm_token'),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  image: text('image'),
  url: text('url'),
  scheduledAt: timestamp('scheduled_at').defaultNow().notNull(),
  isMulticast: boolean('is_multicast').default(false).notNull(),
  screen: varchar('screen', { length: 255 }).default('BeritaScreen').notNull(),
  read: int('read').default(0).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

