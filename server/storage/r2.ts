import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ── Validate required env vars ───────────────────────────────────────────────

const REQUIRED_ENV = [
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_URL",
] as const;

function getR2Config() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required R2 environment variables: ${missing.join(", ")}. ` +
        `Set them in Railway or .env to enable Cloudflare R2 storage.`
    );
  }
  return {
    accountId: process.env.R2_ACCOUNT_ID!,
    bucket: process.env.R2_BUCKET!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    publicUrl: process.env.R2_PUBLIC_URL!.replace(/\/$/, ""), // strip trailing slash
  };
}

// ── Lazy-init S3 client (allows graceful degradation if env vars missing) ────

let _client: S3Client | null = null;
let _config: ReturnType<typeof getR2Config> | null = null;

function getClient(): S3Client {
  if (!_client) {
    _config = getR2Config();
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${_config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: _config.accessKeyId,
        secretAccessKey: _config.secretAccessKey,
      },
    });
  }
  return _client;
}

function getBucket(): string {
  if (!_config) getClient(); // ensure config is loaded
  return _config!.bucket;
}

function getPublicBase(): string {
  if (!_config) getClient();
  return _config!.publicUrl;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Check if R2 env vars are configured (without throwing) */
export function isR2Configured(): boolean {
  return REQUIRED_ENV.every((k) => !!process.env[k]);
}

/** Upload a buffer to R2 */
export async function uploadObject(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  } catch (err) {
    throw new Error(
      `R2 upload failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Delete an object from R2 */
export async function deleteObject(key: string): Promise<void> {
  try {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    );
  } catch (err) {
    throw new Error(
      `R2 delete failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Generate a presigned GET URL with a TTL (for auth-gated content) */
export async function getPresignedGetUrl(
  key: string,
  ttlSeconds: number = 3600
): Promise<string> {
  try {
    return await getSignedUrl(
      getClient(),
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
      { expiresIn: ttlSeconds }
    );
  } catch (err) {
    throw new Error(
      `R2 presign failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Get the public URL for an object (for display images / thumbnails) */
export function getPublicUrl(key: string): string {
  return `${getPublicBase()}/${key}`;
}

/** Check if an object exists in R2 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    );
    return true;
  } catch (err: any) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw new Error(
      `R2 HEAD failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Health check — HEAD the bucket to confirm connectivity. Call at startup. */
export async function checkR2Connectivity(): Promise<void> {
  try {
    await getClient().send(
      new HeadBucketCommand({ Bucket: getBucket() })
    );
    console.log(`R2 connected: bucket "${getBucket()}" is accessible`);
  } catch (err) {
    console.error(
      `R2 connectivity check FAILED for bucket "${getBucket()}":`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      `Cannot reach R2 bucket "${getBucket()}". Check R2_* env vars and bucket permissions.`
    );
  }
}
