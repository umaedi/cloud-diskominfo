import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { stream } from 'hono/streaming';
import { serve } from '@hono/node-server';
import { env } from './config/env.js';
import { StorageService } from './services/storage.service.js';
import { UploadController } from './controllers/upload.controller.js';
import { InstagramController } from './controllers/instagram.controller.js';
import { FCMController } from './controllers/fcm.controller.js';
import { NotificationController } from './controllers/notification.controller.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*', // Customize this for production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

// Root API Welcome route
app.get('/', (c) => {
  return c.text('Welcome to Cloud API Dinas Komunikasi dan Informatika Kabupaten Tulang Bawang');
});

// Health check endpoint
app.get('/health', (c) => c.json({ status: 'OK', timestamp: new Date().toISOString() }));

// API Routes
app.post('/api/upload', UploadController.upload);
app.get('/api/images', UploadController.list);
app.get('/api/images/:id', UploadController.getDetail);
app.delete('/api/images/:id', UploadController.delete);

// Instagram Routes
app.get('/api/instagram', InstagramController.index);
app.get('/api/instagram/', InstagramController.index);
app.get('/api/instagram/:id', InstagramController.show);
app.post('/api/instagram/refresh', InstagramController.manualRefresh);

// FCM Token Routes
app.get('/api/fcm-token', FCMController.getTokens);
app.post('/api/fcm-token/store', FCMController.store);

// Notification Routes
app.get('/api/notification', NotificationController.index);
app.get('/api/notification/count', NotificationController.count);
app.get('/api/notification/show', NotificationController.show);
app.post('/api/notification/store', NotificationController.store);

// Image Streaming / Proxy Route
app.get('/api/stream/:pathFile', async (c) => {
  let pathFile = c.req.param('pathFile');
  pathFile = pathFile.replace(/\|/g, '/');
  pathFile = pathFile.replace(/^\/+/, ''); // ltrim '/'

  if (pathFile.includes('..')) {
    return c.text('Not Found', 404);
  }

  const allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
  const ext = pathFile.split('.').pop()?.toLowerCase() || '';

  if (!allowedExt.includes(ext)) {
    return c.text('Not Found', 404);
  }

  try {
    const { stream: nodeStream, contentType } = await StorageService.getFileStream(pathFile);
    
    if (!nodeStream) {
      return c.text('Not Found', 404);
    }

    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };

    c.header('Content-Type', mimeTypes[ext] || contentType || 'application/octet-stream');
    c.header('Content-Disposition', `inline; filename="${pathFile.split('/').pop()}"`);
    c.header('Cache-Control', 'public, max-age=31536000, immutable');

    return stream(c, async (streamInstance) => {
      for await (const chunk of nodeStream) {
        await streamInstance.write(chunk);
      }
    });

  } catch (error) {
    console.error('Error streaming file:', error);
    return c.text('Not Found', 404);
  }
});

// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled server error:', err);
  return c.json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  }, 500);
});

// Not Found Handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not Found',
    message: `Route not found: ${c.req.method} ${c.req.path}`,
  }, 404);
});

// Start server
console.log(`Starting Hono server on port ${env.PORT}...`);
serve({
  fetch: app.fetch,
  port: env.PORT,
});
