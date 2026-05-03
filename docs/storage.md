# Echo Me — File Storage (Cloudflare R2)

## Overview

As of PR C, all new file uploads (photos, voice journals, persona images, media) are stored in **Cloudflare R2** instead of the Railway container's ephemeral disk. This prevents data loss on redeploys.

Legacy files uploaded before this change remain on local disk and are served via the existing `/uploads/*` routes. A future migration (PR E) will move these to R2.

## Architecture

```
Client -> POST multipart -> Express/multer (temp disk) -> Sharp resize (photos) -> PutObject to R2 -> delete temp -> respond
```

### Photo Pipeline (Sharp)

Every photo upload produces three variants:

| Variant | Size | Format | Quality | Use |
|---------|------|--------|---------|-----|
| **Display** | 1600px longest edge | WebP | 80 | Main viewing |
| **Thumbnail** | 400x400 cover crop | WebP | 70 | Listings, timeline |
| **Original** | As-uploaded | Original | Original | Archival (future paid tier access) |

Accepted formats: **JPEG, PNG, WebP, HEIC, HEIF** (HEIC support via Sharp/libvips).

### R2 Key Structure

```
photos/{personaId}/{photoMemoryId}/display.webp
photos/{personaId}/{photoMemoryId}/thumbnail.webp
photos/{personaId}/{photoMemoryId}/original.{ext}
audio/{userId}/{entryId}/{filename}
personas/{personaId}/photo.webp
media/{personaId}/{mediaId}/{originalFilename}
```

Keys are organized by `personaId` (not `userId`) to support heir handoff — when an Echo transfers to heirs, the files remain accessible regardless of the original creator's account state.

## Serving

| Content Type | Access Method | Why |
|---|---|---|
| Photo display/thumbnail | R2 public URL (302 redirect) | Fast CDN delivery, public images |
| Photo original | Presigned URL (1hr TTL) | Full-res is sensitive, auth-gated |
| Voice journal audio | Presigned URL (1hr TTL) | Audio is always sensitive |
| Persona photos | R2 public URL | Profile images are public |
| Media files | R2 public URL or presigned | Depends on content type |

Legacy local files are served via `res.sendFile()` through the existing Express routes.

## Environment Variables

All required in Railway (or `.env` for local dev):

| Variable | Description | Example |
|---|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID | `abc123def456` |
| `R2_BUCKET` | R2 bucket name | `echome-media` |
| `R2_ACCESS_KEY_ID` | R2 API token access key | `(from Cloudflare dashboard)` |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret | `(from Cloudflare dashboard)` |
| `R2_PUBLIC_URL` | Public URL for the R2 bucket | `https://pub-xxxx.r2.dev` |

If any R2 env var is missing, uploads fall back to local disk with a startup warning.

## CORS Configuration

The R2 bucket needs CORS rules for browser access. Configure in the Cloudflare dashboard under **R2 > echome-media > Settings > CORS Policy**:

```json
[
  {
    "AllowedOrigins": [
      "https://echome-production-a33e.up.railway.app",
      "https://app.echome.family",
      "http://localhost:5000"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

## Database Schema

The `storage_provider` column on each table enables gradual migration:

- `'local'` — file on disk, served via Express
- `'r2'` — file in R2, served via redirect/presigned URL

New columns added by migration `0014_add_storage_columns.sql`:

**photo_memories:** `storage_provider`, `storage_key`, `original_key`, `thumbnail_key`, `original_size_bytes`, `display_size_bytes`, `width`, `height`, `mime_type`

**journal_entries:** `audio_storage_provider`, `audio_storage_key`, `audio_size_bytes`

**personas:** `photo_storage_provider`, `photo_storage_key`

**media:** `storage_provider`, `storage_key`, `size_bytes`

## Startup Health Check

On boot, the server runs `HeadBucket` against the R2 bucket. If it fails, a warning is logged but the server continues (falling back to local storage). Check Railway logs for:

- `R2 connected: bucket "echome-media" is accessible` — all good
- `R2 storage unavailable` — check env vars and bucket permissions
- `R2 env vars not configured` — env vars missing, using local disk
