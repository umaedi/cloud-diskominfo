import { Context } from 'hono';
import { z } from 'zod';
import { db } from '../config/db.js';
import { fcmTokens } from '../db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';

const storeTokenSchema = z.object({
  fcm_token: z.string().min(1, 'FMC Token wajib diisi!'),
  user_id: z.string().min(1, 'User ID wajib diisi!'),
});

export class FCMController {
  /**
   * Get all stored FCM tokens
   */
  public static async getTokens(c: Context) {
    try {
      const results = await db
        .select({ token: fcmTokens.fcmToken })
        .from(fcmTokens)
        .where(isNotNull(fcmTokens.fcmToken));

      const tokens = results.map((r) => r.token);
      return c.json(tokens);
    } catch (error: any) {
      console.error('FCM getTokens error:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve FCM tokens',
        message: error.message,
      }, 500);
    }
  }

  /**
   * Save or update an FCM token for a user
   */
  public static async store(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}));
      
      const parsed = storeTokenSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({
          success: false,
          error: 'Validation Error',
          messages: parsed.error.flatten().fieldErrors,
        }, 422);
      }

      const { fcm_token, user_id } = parsed.data;

      // Check if user already has an FCM token
      const existing = await db
        .select()
        .from(fcmTokens)
        .where(eq(fcmTokens.userId, user_id))
        .limit(1);

      let savedRecord;

      if (existing.length > 0) {
        // Update
        await db
          .update(fcmTokens)
          .set({ fcmToken: fcm_token, updatedAt: new Date() })
          .where(eq(fcmTokens.userId, user_id));
        
        savedRecord = {
          ...existing[0],
          fcmToken: fcm_token,
          updatedAt: new Date(),
        };
      } else {
        // Insert
        const insertResult = await db.insert(fcmTokens).values({
          userId: user_id,
          fcmToken: fcm_token,
        });
        
        savedRecord = {
          id: insertResult[0].insertId,
          userId: user_id,
          fcmToken: fcm_token,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      console.log('FCM Token berhasil disimpan:', savedRecord);

      return c.json({
        success: true,
        message: 'FCM Token berhasil disimpan atau diperbarui',
        data: savedRecord,
      }, 201);

    } catch (error: any) {
      console.error('FCM store error:', error);
      return c.json({
        success: false,
        error: 'Failed to save FCM token',
        message: error.message,
      }, 500);
    }
  }
}
