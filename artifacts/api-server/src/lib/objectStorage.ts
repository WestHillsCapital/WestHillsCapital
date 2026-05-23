import {
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  R2ObjectHandle,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";
import { r2Client } from "./r2Client";

export type { R2ObjectHandle } from "./objectAcl";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class StorageMisconfigError extends Error {
  constructor(detail: string) {
    super(`Storage is not configured: ${detail}`);
    this.name = "StorageMisconfigError";
    Object.setPrototypeOf(this, StorageMisconfigError.prototype);
  }
}

export function assertStorageCredentials(): void {
  const missing: string[] = [];
  if (!process.env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!process.env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!process.env.R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");
  if (missing.length > 0) {
    throw new StorageMisconfigError(
      `R2 credentials not configured — set: ${missing.join(", ")}`,
    );
  }
}

export function wrapR2Error(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  const statusCode = (err as Record<string, unknown>)?.$metadata
    ? ((err as Record<string, unknown>).$metadata as Record<string, unknown>)?.httpStatusCode
    : undefined;

  const isAuthOrPermission =
    msg.includes("InvalidAccessKeyId") ||
    msg.includes("SignatureDoesNotMatch") ||
    msg.includes("AccessDenied") ||
    msg.includes("Forbidden") ||
    statusCode === 401 ||
    statusCode === 403;

  if (isAuthOrPermission) {
    throw new StorageMisconfigError(
      "R2 auth error — check R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ACCOUNT_ID. " +
        `Underlying: ${msg}`,
    );
  }

  const isMissing =
    msg.includes("NoSuchBucket") ||
    msg.includes("NoSuchKey") ||
    statusCode === 404;

  if (isMissing) {
    throw new StorageMisconfigError(
      "R2 bucket or object not found — check R2_BUCKET_NAME. " +
        `Underlying: ${msg}`,
    );
  }

  throw err;
}

export class ObjectStorageService {
  private getBucket(): string {
    const b = process.env.R2_BUCKET_NAME ?? "";
    if (!b) throw new StorageMisconfigError("R2_BUCKET_NAME is not set");
    return b;
  }

  getPublicObjectSearchPaths(): string[] {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS ?? "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0),
      ),
    );
    if (paths.length === 0) {
      throw new StorageMisconfigError(
        "PUBLIC_OBJECT_SEARCH_PATHS not set — set to comma-separated R2 key prefixes, e.g. 'public'.",
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR ?? "";
    if (!dir) {
      throw new StorageMisconfigError(
        "PRIVATE_OBJECT_DIR is not set — set to the R2 key prefix for private uploads, e.g. 'objects'.",
      );
    }
    return dir.replace(/\/$/, "");
  }

  async searchPublicObject(filePath: string): Promise<R2ObjectHandle | null> {
    const bucket = this.getBucket();
    for (const prefix of this.getPublicObjectSearchPaths()) {
      const key = `${prefix.replace(/\/$/, "")}/${filePath}`.replace(/\/+/g, "/");
      try {
        await r2Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { bucket, key, name: key };
      } catch {
        // not in this prefix — try next
      }
    }
    return null;
  }

  async downloadObject(
    handle: R2ObjectHandle,
    cacheTtlSec = 3600,
  ): Promise<Response> {
    const aclPolicy = await getObjectAclPolicy(handle);
    const isPublic = aclPolicy?.visibility === "public";

    const result = await r2Client.send(
      new GetObjectCommand({ Bucket: handle.bucket, Key: handle.key }),
    );

    if (!result.Body) throw new ObjectNotFoundError();

    const webStream = result.Body.transformToWebStream();

    const headers: Record<string, string> = {
      "Content-Type": result.ContentType ?? "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (result.ContentLength) {
      headers["Content-Length"] = String(result.ContentLength);
    }

    return new Response(webStream, { headers });
  }

  /**
   * Upload a Buffer to R2.
   * `objectId` is the path beneath PRIVATE_OBJECT_DIR, e.g. "logos/uuid".
   * Returns the normalized object path: "/objects/uuid"
   */
  async uploadBuffer(
    objectId: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const bucket = this.getBucket();
    const privateDir = this.getPrivateObjectDir();
    const key = `${privateDir}/${objectId}`.replace(/\/+/g, "/");
    try {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: metadata,
        }),
      );
    } catch (err) {
      wrapR2Error(err);
    }
    return `/objects/${objectId}`;
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const bucket = this.getBucket();
    const privateDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const key = `${privateDir}/uploads/${objectId}`.replace(/\/+/g, "/");

    const command = new PutObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(r2Client, command, { expiresIn: 900 });
  }

  async getObjectEntityFile(objectPath: string): Promise<R2ObjectHandle> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const entityId = objectPath.slice("/objects/".length);
    const bucket = this.getBucket();
    const privateDir = this.getPrivateObjectDir();
    const key = `${privateDir}/${entityId}`.replace(/\/+/g, "/");

    try {
      await r2Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      throw new ObjectNotFoundError();
    }

    return { bucket, key, name: key };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://")) {
      return rawPath;
    }
    try {
      const url = new URL(rawPath);
      const bucket = this.getBucket();
      const privateDir = this.getPrivateObjectDir();
      const prefix = `/${bucket}/${privateDir}/`;
      if (url.pathname.startsWith(prefix)) {
        const entityId = url.pathname.slice(prefix.length);
        return `/objects/${entityId}`;
      }
    } catch {
      // not a recognizable URL — return as-is
    }
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  /**
   * Download an object (addressed by its /objects/... storage key) to a Buffer.
   * Throws ObjectNotFoundError if the key does not exist.
   */
  async downloadObjectToBuffer(storageKey: string): Promise<Buffer> {
    const handle = await this.getObjectEntityFile(storageKey);
    const result = await r2Client.send(
      new GetObjectCommand({ Bucket: handle.bucket, Key: handle.key }),
    );
    if (!result.Body) throw new ObjectNotFoundError();
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  /**
   * Delete an object by its /objects/... storage key.
   * Silently succeeds if the object does not exist (ignoreNotFound).
   */
  async deleteObject(storageKey: string): Promise<void> {
    let handle: R2ObjectHandle;
    try {
      handle = await this.getObjectEntityFile(storageKey);
    } catch (err) {
      if (err instanceof ObjectNotFoundError) return;
      throw err;
    }
    try {
      await r2Client.send(
        new DeleteObjectCommand({ Bucket: handle.bucket, Key: handle.key }),
      );
    } catch {
      // R2 DeleteObject is idempotent — ignore errors silently
    }
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: R2ObjectHandle;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
