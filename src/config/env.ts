import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url().describe('MySQL database connection URL'),
  MINIO_ENDPOINT: z.string().describe('MinIO endpoint URL'),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET: z.string().default('images'),
  MINIO_USE_SSL: z.preprocess((val) => val === 'true', z.boolean()).default(false),
  MINIO_PUBLIC_URL: z.string().optional().describe('Public endpoint for files, defaults to endpoint/bucket if not specified'),
  INSTAGRAM_TOKEN: z.string().optional().describe('Default Instagram graph API access token'),
  FIREBASE_CREDENTIAL_PATH: z.string().optional().describe('Path to Firebase Service Account JSON credentials file'),
});

export const env = envSchema.parse(process.env);
