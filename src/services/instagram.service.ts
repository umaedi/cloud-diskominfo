import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { settings } from '../db/schema.js';
import { env } from '../config/env.js';

export class InstagramService {
  private static TOKEN_KEY = 'instagram_access_token';
  // Expiration threshold: Refresh if the token has less than 15 days remaining
  private static REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; 

  /**
   * Retrieves the active access token. Automatically handles self-refreshing
   * if the stored token is approaching expiration.
   */
  public static async getActiveToken(): Promise<string> {
    // 1. Fetch token configuration from database
    const results = await db.select().from(settings).where(eq(settings.key, this.TOKEN_KEY)).limit(1);
    
    let dbToken: string | null = null;
    let expiresAt: Date | null = null;

    if (results.length > 0) {
      dbToken = results[0].value;
      expiresAt = results[0].expiresAt;
    }

    // 2. If no token in DB, bootstrap using env configuration
    if (!dbToken) {
      if (!env.INSTAGRAM_TOKEN) {
        throw new Error('No Instagram token found. Set INSTAGRAM_TOKEN in .env or run manual setup.');
      }
      
      console.log('Bootstrapping Instagram token from environment to database...');
      // By default, assume a new long-lived token expires in 60 days
      const defaultExpiration = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      await this.saveTokenToDb(env.INSTAGRAM_TOKEN, defaultExpiration);
      
      return env.INSTAGRAM_TOKEN;
    }

    // 3. Check expiration
    const now = Date.now();
    const expirationTime = expiresAt ? expiresAt.getTime() : 0;
    const timeRemaining = expirationTime - now;

    // 4. Self-healing/Auto-refresh: If expired or approaching expiration (less than 15 days left)
    if (timeRemaining < this.REFRESH_THRESHOLD_MS) {
      console.log(`Instagram token expires at ${expiresAt?.toISOString()}. Refreshing token...`);
      try {
        const refreshedToken = await this.refreshInstagramToken(dbToken);
        return refreshedToken;
      } catch (err: any) {
        console.error('Auto-refresh of Instagram token failed:', err.message);
        
        // If the token is not fully expired yet, fallback to it so service is not disrupted
        if (expirationTime > now) {
          console.warn('Falling back to currently active (but near-expiration) token.');
          return dbToken;
        }
        throw new Error(`Instagram token has expired, and auto-refresh failed: ${err.message}`);
      }
    }

    return dbToken;
  }

  /**
   * Calls the Instagram API to refresh a long-lived access token.
   */
  public static async refreshInstagramToken(currentToken: string): Promise<string> {
    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.searchParams.append('grant_type', 'ig_refresh_token');
    url.searchParams.append('access_token', currentToken);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();
    const newToken = data.access_token;
    
    // expires_in is returned in seconds (usually 5183943 seconds, which is ~60 days)
    const expiresInSeconds = data.expires_in || (60 * 24 * 60 * 60);
    const newExpiration = new Date(Date.now() + expiresInSeconds * 1000);

    await this.saveTokenToDb(newToken, newExpiration);
    console.log(`Instagram token successfully refreshed. New expiry: ${newExpiration.toISOString()}`);
    
    return newToken;
  }

  /**
   * Saves the token and its expiration date to the settings table.
   */
  private static async saveTokenToDb(token: string, expiresAt: Date): Promise<void> {
    const results = await db.select().from(settings).where(eq(settings.key, this.TOKEN_KEY)).limit(1);

    if (results.length > 0) {
      await db.update(settings)
        .set({ value: token, expiresAt })
        .where(eq(settings.key, this.TOKEN_KEY));
    } else {
      await db.insert(settings).values({
        key: this.TOKEN_KEY,
        value: token,
        expiresAt,
      });
    }
  }
}
