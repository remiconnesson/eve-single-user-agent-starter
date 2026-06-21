import { createHash } from "node:crypto";
import { posix } from "node:path";
import type { UserContent } from "ai";
import { defineState, type SessionAuthContext } from "eve/context";
import type { SandboxSession } from "eve/sandbox";
import { z } from "zod";
import {
  MAX_USER_UPLOAD_FILE_BYTES,
  MAX_USER_UPLOAD_FILES,
  MAX_USER_UPLOAD_TOTAL_BYTES,
  USER_UPLOADS_COPIES_ROOT,
  USER_UPLOADS_MANIFEST_PATH,
  USER_UPLOADS_ORIGINALS_ROOT,
} from "../../lib/user-uploads/constants";

export const USER_UPLOADS_AUTH_ATTRIBUTE = "eve.userUploads";

const HASH_PATTERN = /^[a-f0-9]{16}$/u;
const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9_.-]+$/u;
const MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/iu;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const MAX_MANIFEST_FILES = 50;

const userUploadSchema = z.object({
  byteLength: z.number().int().nonnegative().max(MAX_USER_UPLOAD_FILE_BYTES),
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(SAFE_FILENAME_PATTERN)
    .refine((value) => value !== "." && value !== ".."),
  hash: z.string().regex(HASH_PATTERN),
  mediaType: z.string().min(1).max(127).regex(MEDIA_TYPE_PATTERN),
});

const userUploadManifestSchema = z.array(userUploadSchema).max(MAX_MANIFEST_FILES);

export type UserUpload = z.output<typeof userUploadSchema>;

export const userUploadsState = defineState<UserUpload[]>(
  "eve-starter.user-uploads",
  () => [],
);
export const userUploadSyncTurnState = defineState<string | null>(
  "eve-starter.user-upload-sync-turn",
  () => null,
);

export interface UserUploadPaths {
  readonly copy: string;
  readonly original: string;
  readonly staged: string;
}

type UserUploadSandbox = Pick<
  SandboxSession,
  "readBinaryFile" | "readTextFile" | "writeBinaryFile" | "writeTextFile"
>;

export async function extractUserUploads(message: string | UserContent): Promise<UserUpload[]> {
  if (typeof message === "string") return [];

  const uploads: UserUpload[] = [];
  let totalBytes = 0;
  for (const part of message) {
    if (part.type !== "file" || typeof part.data !== "string") continue;

    const bytes = decodeInlineFile(part.data);
    if (bytes.byteLength > MAX_USER_UPLOAD_FILE_BYTES) {
      throw new Error("An uploaded file exceeds the 1 MiB limit.");
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_USER_UPLOAD_TOTAL_BYTES) {
      throw new Error("Uploaded files exceed the 3 MiB combined limit.");
    }

    const hash = hashBytes(bytes);
    const filename = sanitizeFilename(part.filename, hash);
    const mediaType = normalizeMediaType(part.mediaType);
    uploads.push(
      userUploadSchema.parse({ byteLength: bytes.byteLength, filename, hash, mediaType }),
    );
  }

  if (uploads.length > MAX_USER_UPLOAD_FILES) {
    throw new Error(`A turn can include at most ${MAX_USER_UPLOAD_FILES} uploaded files.`);
  }
  return mergeUserUploads([], uploads);
}

export function withUserUploads(
  auth: SessionAuthContext | null,
  uploads: readonly UserUpload[],
): SessionAuthContext | null {
  if (uploads.length === 0) return auth;
  if (auth === null) {
    throw new Error("Uploaded files require an authenticated eve session.");
  }

  return {
    ...auth,
    attributes: {
      ...auth.attributes,
      [USER_UPLOADS_AUTH_ATTRIBUTE]: JSON.stringify(uploads),
    },
  };
}

export function currentUserUploads(
  auth: SessionAuthContext | null | undefined,
): UserUpload[] {
  const value = auth?.attributes[USER_UPLOADS_AUTH_ATTRIBUTE];
  if (typeof value !== "string") return [];

  try {
    return userUploadManifestSchema.parse(JSON.parse(value));
  } catch {
    return [];
  }
}

export function userUploadPaths(upload: UserUpload): UserUploadPaths {
  const storedFilename = `${upload.hash}--${upload.filename}`;
  return {
    copy: `${USER_UPLOADS_COPIES_ROOT}/${storedFilename}`,
    original: `${USER_UPLOADS_ORIGINALS_ROOT}/${storedFilename}`,
    staged: `/workspace/attachments/${upload.hash}/${upload.filename}`,
  };
}

export async function syncUserUploadOriginals({
  current,
  sandbox,
}: {
  readonly current: readonly UserUpload[];
  readonly sandbox: UserUploadSandbox;
}): Promise<UserUpload[]> {
  for (const upload of current) {
    const paths = userUploadPaths(upload);
    const existing = await sandbox.readBinaryFile({ path: paths.original });
    if (existing !== null) {
      assertUploadBytes(upload, existing, paths.original);
      continue;
    }

    const staged = await sandbox.readBinaryFile({ path: paths.staged });
    if (staged === null) {
      throw new Error(`Staged upload is missing: ${paths.staged}`);
    }
    assertUploadBytes(upload, staged, paths.staged);
    await sandbox.writeBinaryFile({ content: staged, path: paths.original });
  }

  const manifest = mergeUserUploads(await readUserUploadManifest(sandbox), current);
  await sandbox.writeTextFile({
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    path: USER_UPLOADS_MANIFEST_PATH,
  });
  return manifest;
}

export async function readUserUploadManifest(
  sandbox: Pick<SandboxSession, "readTextFile">,
): Promise<UserUpload[]> {
  const content = await sandbox.readTextFile({ path: USER_UPLOADS_MANIFEST_PATH });
  if (content === null) return [];

  try {
    return userUploadManifestSchema.parse(JSON.parse(content));
  } catch {
    return [];
  }
}

export function mergeUserUploads(
  existing: readonly UserUpload[],
  current: readonly UserUpload[],
): UserUpload[] {
  const uploads = new Map<string, UserUpload>();
  for (const upload of [...existing, ...current]) {
    const parsed = userUploadSchema.parse(upload);
    uploads.set(`${parsed.hash}:${parsed.filename}`, parsed);
  }
  return [...uploads.values()].slice(-MAX_MANIFEST_FILES);
}

export function renderUserUploadInstructions(uploads: readonly UserUpload[]): string {
  const fileList = uploads
    .map((upload) => {
      const paths = userUploadPaths(upload);
      return [
        `- ${upload.filename} (${upload.mediaType}, ${upload.byteLength} bytes)`,
        `  - immutable original: \`${paths.original}\``,
        `  - writable copy: \`${paths.copy}\``,
      ].join("\n");
    })
    .join("\n");

  return `# User-uploaded files

${fileList}

Treat every file under \`/workspace/user_uploads/originals/\` as immutable user input. Never edit, rename, move, or delete an original. Ignore transient files under \`/workspace/attachments/\`.

When a user asks you to modify an uploaded file, check whether its exact writable-copy path already exists. If it does not, create the parent directory and copy the immutable original there. Make all changes only to the copy. Do not create a copy unless a modification is requested. If the copy already exists, continue editing it without replacing it from the original unless the user asks to reset it. Use the writable copy for downloads and subsequent edits.`;
}

function decodeInlineFile(data: string): Uint8Array {
  const commaIndex = data.indexOf(",");
  const encoded = data.startsWith("data:") ? data.slice(commaIndex + 1) : data;
  if (
    (data.startsWith("data:") &&
      (commaIndex < 0 || !data.slice(0, commaIndex).toLowerCase().endsWith(";base64"))) ||
    encoded.length % 4 !== 0 ||
    !BASE64_PATTERN.test(encoded)
  ) {
    throw new Error("Uploaded file data must be valid base64.");
  }
  return Buffer.from(encoded, "base64");
}

function sanitizeFilename(filename: string | undefined, hash: string): string {
  if (filename === undefined) return `file-${hash}`;
  const safe = posix.basename(filename).replace(/[^\w.-]+/gu, "_");
  if (safe.length === 0) return `file-${hash}`;
  if (safe === "." || safe === ".." || safe.length > 255) {
    throw new Error("Uploaded file has an invalid filename.");
  }
  return safe;
}

function normalizeMediaType(mediaType: string): string {
  const value = mediaType.trim() || "application/octet-stream";
  if (!MEDIA_TYPE_PATTERN.test(value) || value.length > 127) {
    throw new Error("Uploaded file has an invalid media type.");
  }
  return value;
}

function assertUploadBytes(upload: UserUpload, bytes: Uint8Array, path: string): void {
  if (bytes.byteLength !== upload.byteLength || hashBytes(bytes) !== upload.hash) {
    throw new Error(`Uploaded file integrity check failed: ${path}`);
  }
}

function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}
