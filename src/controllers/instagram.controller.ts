import { Context } from 'hono';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { CacheService } from '../services/cache.service.js';
import { InstagramService } from '../services/instagram.service.js';

const md5 = (str: string): string => {
  return crypto.createHash('md5').update(str).digest('hex');
};

export class InstagramController {
  /**
   * Get list of instagram posts (caching supported)
   */
  public static async index(c: Context) {
    try {
      // Respect manual token query param, otherwise use the self-healing DB token
      const token = c.req.query('token') || await InstagramService.getActiveToken();
      const mediaType = c.req.query('media_type');

      if (!token) {
        return c.json({
          success: false,
          error: 'Instagram access token is required.',
        }, 400);
      }

      // Cache key: instagram:index:[md5 of token + mediaType]
      const cacheKey = `instagram:index:${md5(token + (mediaType || ''))}`;

      const media = await CacheService.remember(cacheKey, 300, async () => {
        const url = new URL('https://graph.instagram.com/me/media');
        url.searchParams.append('access_token', token);
        url.searchParams.append('fields', 'id,caption,media_url,media_type');
        url.searchParams.append('limit', '15');

        const response = await fetch(url.toString());
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Instagram API error: ${response.statusText}`);
        }

        const resBody = await response.json();
        const data = resBody.data || [];

        // Apply media type filter if specified
        let filtered = data;
        if (mediaType) {
          filtered = data.filter((item: any) => item.media_type === mediaType);
        }

        // Limit results to first 6 items
        return filtered.slice(0, 6);
      });

      return c.json({
        success: true,
        message: 'List data postingan instagram',
        data: media,
      });

    } catch (error: any) {
      console.error('Instagram index controller error:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve Instagram posts',
        message: error.message,
      }, 500);
    }
  }

  /**
   * Get details of a specific instagram post (caching supported)
   */
  public static async show(c: Context) {
    try {
      const id = c.req.param('id');
      // Respect manual token query param, otherwise use the self-healing DB token
      const token = c.req.query('token') || await InstagramService.getActiveToken();

      if (!id) {
        return c.json({
          success: false,
          error: 'Instagram post ID is required',
        }, 400);
      }

      if (!token) {
        return c.json({
          success: false,
          error: 'Instagram access token is required.',
        }, 400);
      }

      // Cache key: instagram:show:[md5 of id + token]
      const cacheKey = `instagram:show:${md5(id + token)}`;

      const data = await CacheService.remember(cacheKey, 300, async () => {
        const url = new URL(`https://graph.instagram.com/${id}`);
        url.searchParams.append('access_token', token);
        url.searchParams.append('fields', 'id,caption,media_url,media_type,permalink');

        const response = await fetch(url.toString());

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Instagram API error: ${response.statusText}`);
        }

        return await response.json();
      });

      return c.json({
        success: true,
        message: 'Detail postingan instagram',
        data,
      });

    } catch (error: any) {
      console.error('Instagram show controller error:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve Instagram post details',
        message: error.message,
      }, 500);
    }
  }

  /**
   * Manually trigger an Instagram token refresh
   */
  public static async manualRefresh(c: Context) {
    try {
      const currentToken = await InstagramService.getActiveToken();
      
      console.log('Manually refreshing Instagram token...');
      const newToken = await InstagramService.refreshInstagramToken(currentToken);

      return c.json({
        success: true,
        message: 'Instagram token refreshed successfully',
        data: {
          tokenPreview: `${newToken.substring(0, 10)}...${newToken.substring(newToken.length - 5)}`,
        }
      });
    } catch (error: any) {
      console.error('Instagram manual refresh error:', error);
      return c.json({
        success: false,
        error: 'Failed to refresh Instagram token',
        message: error.message,
      }, 500);
    }
  }
}
