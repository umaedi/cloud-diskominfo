import { 
  HeadBucketCommand, 
  CreateBucketCommand, 
  PutObjectCommand, 
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/s3.js';
import { env } from '../config/env.js';

export class StorageService {
  private static bucketInitialized = false;

  /**
   * Ensures that the target bucket exists, creating it if it doesn't.
   */
  public static async ensureBucketExists(bucketName: string = env.MINIO_BUCKET): Promise<void> {
    if (this.bucketInitialized) return;

    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      this.bucketInitialized = true;
    } catch (error: any) {
      // If bucket does not exist, create it
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        console.log(`Bucket '${bucketName}' not found. Creating it...`);
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
          
          // Set bucket policy to allow public read access for convenience if needed, 
          // or we can generate presigned URLs. Let's make it public readable for public URLs
          // and allow presigned URLs for private files.
          // For now, we will rely on MinIO's default policy or presigned URLs.
          this.bucketInitialized = true;
          console.log(`Bucket '${bucketName}' successfully created.`);
        } catch (createError) {
          console.error(`Failed to create bucket '${bucketName}':`, createError);
          throw createError;
        }
      } else {
        console.error(`Failed to check bucket existence:`, error);
        throw error;
      }
    }
  }

  /**
   * Uploads a file buffer to MinIO.
   */
  public static async uploadFile(
    fileBuffer: Buffer,
    key: string,
    mimeType: string,
    bucketName: string = env.MINIO_BUCKET
  ): Promise<void> {
    await this.ensureBucketExists(bucketName);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    await s3Client.send(command);
  }

  /**
   * Deletes a file from MinIO.
   */
  public static async deleteFile(
    key: string,
    bucketName: string = env.MINIO_BUCKET
  ): Promise<void> {
    await this.ensureBucketExists(bucketName);

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);
  }

  /**
   * Generates a public URL for a given file key.
   */
  public static getPublicUrl(key: string, bucketName: string = env.MINIO_BUCKET): string {
    if (env.MINIO_PUBLIC_URL) {
      // Clean up slash issues
      const baseUrl = env.MINIO_PUBLIC_URL.endsWith('/') 
        ? env.MINIO_PUBLIC_URL.slice(0, -1) 
        : env.MINIO_PUBLIC_URL;
      return `${baseUrl}/${key}`;
    }
    
    const endpoint = env.MINIO_ENDPOINT.endsWith('/') 
      ? env.MINIO_ENDPOINT.slice(0, -1) 
      : env.MINIO_ENDPOINT;
    return `${endpoint}/${bucketName}/${key}`;
  }

  /**
   * Generates a temporary presigned URL for secure access.
   */
  public static async getPresignedUrl(
    key: string,
    expiresInSeconds: number = 3600, // 1 hour
    bucketName: string = env.MINIO_BUCKET
  ): Promise<string> {
    await this.ensureBucketExists(bucketName);

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Retrieves a read stream for a given file key from S3/MinIO.
   */
  public static async getFileStream(
    key: string,
    bucketName: string = env.MINIO_BUCKET
  ): Promise<{ stream: any; contentType: string | undefined }> {
    await this.ensureBucketExists(bucketName);

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);
    return {
      stream: response.Body,
      contentType: response.ContentType,
    };
  }
}
