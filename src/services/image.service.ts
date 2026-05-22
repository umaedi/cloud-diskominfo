import sharp from 'sharp';

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
}

export interface ImageProcessingResult {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  format: string;
}

export class ImageService {
  /**
   * Processes the input image buffer (resizing, compressing, formatting)
   */
  public static async processImage(
    imageBuffer: Buffer,
    options: ImageProcessingOptions
  ): Promise<ImageProcessingResult> {
    let pipeline = sharp(imageBuffer);

    // Get original metadata to determine defaults
    const metadata = await pipeline.metadata();
    
    const targetFormat = options.format || 'webp';
    const targetQuality = options.quality !== undefined ? options.quality : 80;

    // Resize if width or height is provided
    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width,
        height: options.height,
        fit: 'inside', // preserve aspect ratio, don't crop
        withoutEnlargement: true, // don't enlarge image if original is smaller
      });
    }

    // Apply format and quality
    switch (targetFormat) {
      case 'webp':
        pipeline = pipeline.webp({ quality: targetQuality });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality: targetQuality, progressive: true });
        break;
      case 'png':
        // PNG is lossless, quality controls compression speed/size or color palette
        pipeline = pipeline.png({ quality: targetQuality, compressionLevel: 8 });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality: targetQuality });
        break;
      default:
        pipeline = pipeline.webp({ quality: targetQuality });
        break;
    }

    // Output processed image
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      size: info.size,
      format: info.format,
    };
  }

  /**
   * Helper to validate if buffer is a valid image
   */
  public static async isValidImage(buffer: Buffer): Promise<boolean> {
    try {
      await sharp(buffer).metadata();
      return true;
    } catch {
      return false;
    }
  }
}
