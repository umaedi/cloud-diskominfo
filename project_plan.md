# Project Plan

## Hono + Drizzle + MinIO Image Upload Service

---

# 1. Tujuan Project

Membangun backend upload service menggunakan:

- Node.js
- Hono Framework
- Drizzle ORM
- MySQL
- MinIO (S3 Compatible Storage)

Backend harus mendukung:

- Multipart upload
- Upload gambar dari frontend
- Resize gambar
- Compress gambar
- Pengaturan quality gambar dari frontend
- Penyimpanan metadata file ke database
- Presigned URL/public URL
- Validasi file upload
- Struktur scalable production-ready

---

# 2. Tech Stack

## Backend

- Sharp (image processing)
- AWS SDK S3 v3
- Zod validation

---

# 3. Fitur Utama

## Upload Multipart

Frontend dapat mengirim:

- file gambar
- quality
- width
- height
- format output

Contoh payload:

```json
{
  "quality": 80,
  "width": 1280,
  "height": 720,
  "format": "webp"
}
```
