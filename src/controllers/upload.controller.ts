import { Context } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc } from 'drizzle-orm';
import { db } from '../config/db.js';
import { uploadedImages } from '../db/schema.js';
import { ImageService } from '../services/image.service.js';
import { StorageService } from '../services/storage.service.js';
import { env } from '../config/env.js';

// Input validation schema using Zod
const uploadQuerySchema = z.object({
  width: z.preprocess((val) => (val ? Number(val) : undefined), z.number().int().min(1).max(5000).optional()),
  height: z.preprocess((val) => (val ? Number(val) : undefined), z.number().int().min(1).max(5000).optional()),
  quality: z.preprocess((val) => (val ? Number(val) : undefined), z.number().int().min(1).max(100).default(80)),
  format: z.enum(['webp', 'jpeg', 'png', 'avif']).default('webp'),
});

const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export class UploadController {
  /**
   * Handle image upload and processing
   */
  public static async upload(c: Context) {
    try {
      const body = await c.req.parseBody();
      const file = body['image'];

      if (!file || !(file instanceof File)) {
        return c.json({ success: false, error: 'No image file provided in field "image"' }, 400);
      }

      // Check MIME type
      if (!allowedMimeTypes.includes(file.type)) {
        return c.json({ success: false, error: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}` }, 400);
      }

      // Parse and validate sizing/quality options
      const parsedOptions = uploadQuerySchema.safeParse(body);
      if (!parsedOptions.success) {
        return c.json({ success: false, error: 'Invalid parameters', details: parsedOptions.error.format() }, 400);
      }

      const { width, height, quality, format } = parsedOptions.data;

      // Read file into Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Verify the buffer is actually an image
      const isValid = await ImageService.isValidImage(buffer);
      if (!isValid) {
        return c.json({ success: false, error: 'Uploaded file is corrupted or not a valid image' }, 400);
      }

      // Process image using Sharp
      const processed = await ImageService.processImage(buffer, {
        width,
        height,
        quality,
        format,
      });

      // Generate a unique storage key (filename)
      const fileId = uuidv4();
      const fileExtension = processed.format === 'jpeg' ? 'jpg' : processed.format;
      const storageKey = `${fileId}.${fileExtension}`;
      const processedMimeType = `image/${processed.format}`;

      // Upload to storage (MinIO)
      await StorageService.uploadFile(processed.buffer, storageKey, processedMimeType);

      // Save metadata to MySQL using Drizzle ORM
      await db.insert(uploadedImages).values({
        id: fileId,
        originalName: file.name,
        mimeType: file.type,
        size: processed.size,
        originalSize: file.size,
        width: processed.width,
        height: processed.height,
        format: processed.format,
        quality,
        storageKey,
        bucket: env.MINIO_BUCKET,
      });

      const publicUrl = StorageService.getPublicUrl(storageKey);
      const presignedUrl = await StorageService.getPresignedUrl(storageKey);

      return c.json({
        success: true,
        message: 'Image uploaded and processed successfully',
        data: {
          id: fileId,
          originalName: file.name,
          mimeType: processedMimeType,
          originalSize: file.size,
          processedSize: processed.size,
          width: processed.width,
          height: processed.height,
          format: processed.format,
          quality,
          publicUrl,
          presignedUrl,
        },
      }, 201);

    } catch (error: any) {
      console.error('Upload handler error:', error);
      return c.json({ success: false, error: 'Internal server error', message: error.message }, 500);
    }
  }

  /**
   * List all uploaded images
   */
  public static async list(c: Context) {
    try {
      const images = await db.select().from(uploadedImages).orderBy(desc(uploadedImages.createdAt));

      const enrichedImages = images.map((img) => ({
        ...img,
        publicUrl: StorageService.getPublicUrl(img.storageKey, img.bucket),
      }));

      return c.json({
        success: true,
        count: enrichedImages.length,
        data: enrichedImages,
      });
    } catch (error: any) {
      console.error('List handler error:', error);
      return c.json({ success: false, error: 'Failed to retrieve images', message: error.message }, 500);
    }
  }

  /**
   * Get detail of a specific image
   */
  public static async getDetail(c: Context) {
    try {
      const id = c.req.param('id');
      if (!id) {
        return c.json({ success: false, error: 'ID parameter is required' }, 400);
      }
      const result = await db.select().from(uploadedImages).where(eq(uploadedImages.id, id)).limit(1);

      if (result.length === 0) {
        return c.json({ success: false, error: 'Image not found' }, 404);
      }

      const img = result[0];
      const publicUrl = StorageService.getPublicUrl(img.storageKey, img.bucket);
      const presignedUrl = await StorageService.getPresignedUrl(img.storageKey, 3600, img.bucket);

      return c.json({
        success: true,
        data: {
          ...img,
          publicUrl,
          presignedUrl,
        },
      });
    } catch (error: any) {
      console.error('GetDetail handler error:', error);
      return c.json({ success: false, error: 'Failed to retrieve image detail', message: error.message }, 500);
    }
  }

  /**
   * Delete a specific image
   */
  public static async delete(c: Context) {
    try {
      const id = c.req.param('id');
      if (!id) {
        return c.json({ success: false, error: 'ID parameter is required' }, 400);
      }
      const result = await db.select().from(uploadedImages).where(eq(uploadedImages.id, id)).limit(1);

      if (result.length === 0) {
        return c.json({ success: false, error: 'Image not found' }, 404);
      }

      const img = result[0];

      // Delete from MinIO
      await StorageService.deleteFile(img.storageKey, img.bucket);

      // Delete from DB
      await db.delete(uploadedImages).where(eq(uploadedImages.id, id));

      return c.json({
        success: true,
        message: 'Image deleted successfully',
      });
    } catch (error: any) {
      console.error('Delete handler error:', error);
      return c.json({ success: false, error: 'Failed to delete image', message: error.message }, 500);
    }
  }
}
