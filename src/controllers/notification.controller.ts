import { Context } from 'hono';
import { z } from 'zod';
import { db } from '../config/db.js';
import { notifications, fcmTokens } from '../db/schema.js';
import { eq, and, gte, lte, sql, isNotNull, count } from 'drizzle-orm';
import { FirebaseService } from '../services/firebase.service.js';

// Input validators
const storeNotificationSchema = z.object({
  user_id: z.string().optional().nullable(),
  fcm_token: z.string().optional().nullable(),
  title: z.string().min(1, 'Title wajib diisi'),
  body: z.string().min(1, 'Body wajib diisi'),
  schedule: z.boolean().optional().default(false),
  is_multicast: z.boolean().optional().default(false),
  url: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
});

export class NotificationController {
  /**
   * Get list of notifications (filtered by user or global paginated)
   */
  public static async index(c: Context) {
    try {
      const userId = c.req.query('user_id') || '';
      const page = parseInt(c.req.query('page') || '1', 10);
      const limit = parseInt(c.req.query('limit') || '10', 10);
      const filter = (c.req.query('filter') || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const all = c.req.query('all') || '';
      const offset = (page - 1) * limit;

      const indonesianDateFormatter = new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      if (userId !== '') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        let queryConditions = [
          eq(notifications.userId, userId),
          eq(notifications.read, 0)
        ];

        let message = 'Data notifikasi hari ini';

        if (all !== '') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          queryConditions.push(gte(notifications.createdAt, sevenDaysAgo));
          message = 'Data notifikasi satu minggu terakhir';
        } else {
          queryConditions.push(gte(notifications.createdAt, startOfToday));
        }

        const data = await db
          .select()
          .from(notifications)
          .where(and(...queryConditions))
          .orderBy(sql`${notifications.createdAt} DESC`);

        const responseData = data.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          date: indonesianDateFormatter.format(item.createdAt),
          status: item.status,
          read: item.read,
        }));

        return c.json({
          success: true,
          message,
          data: responseData,
        });
      } else {
        // Retrieve total count
        const totalResult = await db.select({ count: count() }).from(notifications);
        const total = totalResult[0]?.count || 0;

        // Retrieve paginated records
        const data = await db
          .select()
          .from(notifications)
          .limit(limit)
          .offset(offset)
          .orderBy(filter === 'ASC' ? sql`${notifications.createdAt} ASC` : sql`${notifications.createdAt} DESC`);

        return c.json({
          success: true,
          message: 'Data semua notifikasi',
          data,
          pagination: {
            currentPage: page,
            perPage: limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      }
    } catch (error: any) {
      console.error('Notification index error:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve notifications',
        message: error.message,
      }, 500);
    }
  }

  /**
   * Save a notification and optionally trigger Firebase send
   */
  public static async store(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}));

      const parsed = storeNotificationSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({
          success: false,
          error: 'Validation Error',
          messages: parsed.error.flatten().fieldErrors,
        }, 422);
      }

      const data = parsed.data;
      const shouldSchedule = data.schedule;
      const isMulticast = data.is_multicast;

      const scheduledAtDate = data.scheduled_at ? new Date(data.scheduled_at) : new Date();

      const notificationData = {
        userId: data.user_id || null,
        fcmToken: data.fcm_token || null,
        title: data.title,
        body: data.body,
        image: data.image || null,
        url: data.url || null,
        scheduledAt: scheduledAtDate,
        isMulticast,
        screen: 'BeritaScreen',
        read: 0,
        status: 'pending',
      };

      // 1. Create notification in database
      const insertResult = await db.insert(notifications).values(notificationData);
      const insertedId = insertResult[0].insertId;

      // Prepare metadata payload
      const extraPayload: Record<string, string> = {
        id: String(insertedId),
        title: data.title,
        body: data.body,
        url: data.url || '',
        screen: 'BeritaScreen',
        is_multicast: String(isMulticast),
      };

      if (data.user_id) {
        extraPayload.user_id = data.user_id;
      }

      // 2. Handle scheduled case
      if (shouldSchedule) {
        console.log('Notifikasi terjadwal berhasil dibuat:', insertedId);
        return c.json({
          success: true,
          message: 'Notifikasi terjadwal berhasil dibuat',
          data: { id: insertedId, ...notificationData },
        }, 201);
      }

      // 3. Handle live sending via Firebase
      try {
        if (isMulticast) {
          // Fetch all tokens
          const tokenResults = await db
            .select({ token: fcmTokens.fcmToken })
            .from(fcmTokens)
            .where(isNotNull(fcmTokens.fcmToken));
          const tokens = tokenResults.map((r) => r.token);

          if (tokens.length > 0) {
            await FirebaseService.sendPushNotificationToMultipleDevices(
              tokens,
              data.title,
              data.body,
              data.image,
              extraPayload
            );
          }
        } else {
          let targetToken = data.fcm_token;

          // If no direct token provided, search for user's token
          if (!targetToken && data.user_id) {
            const userTokenResults = await db
              .select({ token: fcmTokens.fcmToken })
              .from(fcmTokens)
              .where(eq(fcmTokens.userId, data.user_id))
              .limit(1);
            targetToken = userTokenResults[0]?.token || null;
          }

          if (targetToken) {
            await FirebaseService.sendPushNotification(
              targetToken,
              data.title,
              data.body,
              data.image,
              extraPayload
            );
          } else {
            console.warn(`No target token found to send push notification for user: ${data.user_id}`);
          }
        }

        // Update status to 'sent'
        await db
          .update(notifications)
          .set({ status: 'sent', updatedAt: new Date() })
          .where(eq(notifications.id, insertedId));

        const updatedRecord = {
          id: insertedId,
          ...notificationData,
          status: 'sent',
          updatedAt: new Date(),
        };

        console.log('Notifikasi berhasil dikirim:', insertedId);
        return c.json({
          success: true,
          message: 'Notifikasi berhasil dikirim',
          data: updatedRecord,
        }, 201);

      } catch (err: any) {
        console.error('Failed to dispatch FCM messages:', err.message);
        // We still return success as notification is saved in DB, but with error warning
        return c.json({
          success: true,
          message: 'Notifikasi tersimpan namun gagal dikirim via Firebase',
          data: { id: insertedId, ...notificationData },
          warning: err.message,
        }, 201);
      }

    } catch (error: any) {
      console.error('Notification store error:', error);
      return c.json({
        success: false,
        error: 'Gagal menyimpan data notifikasi',
        message: error.message,
      }, 500);
    }
  }

  /**
   * Get single notification and mark as read
   */
  public static async show(c: Context) {
    try {
      const userId = c.req.query('user_id');
      const idStr = c.req.query('id');

      if (!userId || !idStr) {
        return c.json({
          success: false,
          error: 'Data tidak ditemukan',
        }, 404);
      }

      const id = parseInt(idStr, 10);

      const results = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
        .limit(1);

      if (results.length === 0) {
        return c.json({
          success: false,
          error: 'Notifikasi tidak ditemukan',
        }, 404);
      }

      // Mark as read and sent
      await db
        .update(notifications)
        .set({ read: 1, status: 'sent', updatedAt: new Date() })
        .where(eq(notifications.id, id));

      const updatedRecord = {
        ...results[0],
        read: 1,
        status: 'sent',
        updatedAt: new Date(),
      };

      return c.json({
        success: true,
        message: 'Data notifikasi',
        data: updatedRecord,
      });

    } catch (error: any) {
      console.error('Notification show error:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve notification details',
        message: error.message,
      }, 500);
    }
  }

  /**
   * Count unread/read notifications for today
   */
  public static async count(c: Context) {
    try {
      const userId = c.req.query('user_id') || '';
      const readParam = c.req.query('read'); // '0' or '1'

      if (!userId) {
        return c.json({
          success: false,
          error: 'User ID is required',
        }, 400);
      }

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const conditions = [
        eq(notifications.userId, userId),
        gte(notifications.createdAt, startOfToday)
      ];

      if (readParam !== undefined && readParam !== null) {
        const readVal = parseInt(readParam, 10);
        if (readVal === 0 || readVal === 1) {
          conditions.push(eq(notifications.read, readVal));
        }
      }

      const countResult = await db
        .select({ total: count() })
        .from(notifications)
        .where(and(...conditions));

      const totalCount = countResult[0]?.total || 0;

      return c.json({
        success: true,
        message: 'Jumlah notifikasi',
        data: totalCount,
      });

    } catch (error: any) {
      console.error('Notification count error:', error);
      return c.json({
        success: false,
        error: 'Failed to count notifications',
        message: error.message,
      }, 500);
    }
  }
}
