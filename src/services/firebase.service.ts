import admin from 'firebase-admin';
import { promises as fs } from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../config/db.js';
import { fcmTokens } from '../db/schema.js';

let messagingInstance: admin.messaging.Messaging | null = null;
let initialized = false;

export class FirebaseService {
  /**
   * Initializes Firebase Admin SDK and returns the Messaging instance.
   * Gracefully throws error if credential is not available, allowing controllers to catch it.
   */
  private static async getMessaging(): Promise<admin.messaging.Messaging> {
    if (initialized && messagingInstance) {
      return messagingInstance;
    }

    const credPath = env.FIREBASE_CREDENTIAL_PATH || 'firebase-credential.json';
    const absolutePath = path.isAbsolute(credPath)
      ? credPath
      : path.join(process.cwd(), credPath);

    try {
      await fs.access(absolutePath);
      const fileContent = await fs.readFile(absolutePath, 'utf8');
      const serviceAccount = JSON.parse(fileContent);

      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      messagingInstance = app.messaging();
      initialized = true;
      console.log('✅ Firebase Admin successfully initialized.');
      return messagingInstance;
    } catch (err: any) {
      console.warn(`⚠️ Warning: Firebase Admin failed to initialize. File not found at ${absolutePath}. Push notifications cannot be sent.`);
      throw new Error(`Firebase credentials not configured: ${err.message}`);
    }
  }

  /**
   * Send push notification to a single device
   */
  public static async sendPushNotification(
    token: string,
    title: string,
    body: string,
    image?: string | null,
    extraData: Record<string, string> = {}
  ): Promise<boolean> {
    try {
      const messaging = await this.getMessaging();

      const dataPayload: Record<string, string> = {
        image: image || '',
        url: extraData.url || '',
      };

      // Ensure all extraData values are strings for FCM payload
      for (const [key, val] of Object.entries(extraData)) {
        dataPayload[key] = String(val);
      }

      const message: admin.messaging.Message = {
        token: token,
        notification: {
          title,
          body,
          ...(image ? { imageUrl: image } : {}),
        },
        data: dataPayload,
      };

      await messaging.send(message);
      console.log(`FCM notification successfully sent to device: ${token.substring(0, 15)}...`);
      return true;
    } catch (error: any) {
      console.error(`Error sending notification to device. Error: ${error.message}`);
      return false;
    }
  }

  /**
   * Send push notification to multiple devices in chunks of 500
   */
  public static async sendPushNotificationToMultipleDevices(
    tokens: string[],
    title: string,
    body: string,
    image?: string | null,
    extraData: Record<string, string> = {}
  ): Promise<any[]> {
    if (tokens.length === 0) {
      return [];
    }

    try {
      const messaging = await this.getMessaging();

      const dataPayload: Record<string, string> = {
        image: image || '',
        url: extraData.url || '',
      };

      for (const [key, val] of Object.entries(extraData)) {
        dataPayload[key] = String(val);
      }

      // Chunk tokens by 500
      const chunkSize = 500;
      const chunks: string[][] = [];
      for (let i = 0; i < tokens.length; i += chunkSize) {
        chunks.push(tokens.slice(i, i + chunkSize));
      }

      const allResults: any[] = [];

      for (let index = 0; index < chunks.length; index++) {
        const batchTokens = chunks[index];

        const message: admin.messaging.MulticastMessage = {
          tokens: batchTokens,
          notification: {
            title,
            body,
            ...(image ? { imageUrl: image } : {}),
          },
          data: dataPayload,
        };

        const report = await messaging.sendEachForMulticast(message);

        let successes = 0;
        let failures = 0;

        // Auto-cleanup invalid tokens
        for (let idx = 0; idx < report.responses.length; idx++) {
          const res = report.responses[idx];
          if (res.success) {
            successes++;
          } else {
            failures++;
            const errorMsg = res.error?.message || '';
            const errorCode = res.error?.code || '';
            const failedToken = batchTokens[idx];

            console.error(`FCM Failure: Token=${failedToken.substring(0, 15)}... | Error=${errorMsg} | Code=${errorCode}`);

            // If the token is invalid/expired, delete from database
            if (
              errorCode === 'messaging/registration-token-not-registered' ||
              errorCode === 'messaging/invalid-argument' ||
              errorMsg.includes('not registered') ||
              errorMsg.includes('Requested entity was not found') ||
              errorMsg.includes('Invalid registration token')
            ) {
              await db.delete(fcmTokens).where(eq(fcmTokens.fcmToken, failedToken));
              console.warn(`Deleted invalid FCM token from database: ${failedToken.substring(0, 15)}...`);
            }
          }
        }

        console.log(`FCM batch #${index} sent. Success: ${successes}, Failures: ${failures}`);

        allResults.push({
          batch: index,
          success: successes,
          failures: failures,
          tokens_sent: batchTokens.length,
        });
      }

      return allResults;
    } catch (error: any) {
      console.error(`Error sending multicast notification: ${error.message}`);
      return [];
    }
  }
}
