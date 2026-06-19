import { posix } from "node:path";
import type { SandboxSession } from "eve/sandbox";
import { z } from "zod";

// Base64 expands files by roughly one third. Keep the encoded request or
// response below Vercel's 4.5 MB function payload limit.
export const MAX_SANDBOX_FILE_BYTES = 3 * 1024 * 1024;

const MAX_SANDBOX_PATH_LENGTH = 1024;
const WORKSPACE_ROOT = "/workspace";
const WORKSPACE_PREFIX = `${WORKSPACE_ROOT}/`;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:/;

const MEDIA_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".gz": "application/gzip",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jsx": "text/javascript",
  ".md": "text/markdown",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".tar": "application/x-tar",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".txt": "text/plain",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".zip": "application/zip",
};

export type SandboxFileErrorCode =
  | "invalid-path"
  | "not-found"
  | "too-large"
  | "unreadable";

type SandboxFileErrorDetails =
  | { readonly code: "invalid-path"; readonly message: string }
  | { readonly code: "not-found"; readonly path: string }
  | { readonly code: "too-large"; readonly byteLength: number; readonly limit: number }
  | { readonly code: "unreadable"; readonly path: string };

export class SandboxFileError extends Error {
  readonly details: SandboxFileErrorDetails;

  constructor(details: SandboxFileErrorDetails) {
    super(errorMessage(details));
    this.name = "SandboxFileError";
    this.details = details;
  }

  get code(): SandboxFileErrorCode {
    return this.details.code;
  }

  get limit(): number | undefined {
    return this.details.code === "too-large" ? this.details.limit : undefined;
  }
}

const sandboxFileInputPathSchema = z.string().superRefine((value, context) => {
  const problem = relativePathProblem(value);
  if (problem === null) return;

  context.addIssue({
    code: "custom",
    message: problem,
  });
});

export const sandboxFilePathSchema = sandboxFileInputPathSchema
  .transform(toAbsoluteWorkspacePath)
  .brand<"SandboxFilePath">();

export type SandboxFilePath = z.output<typeof sandboxFilePathSchema>;

export const downloadSandboxFileOutputSchema = z.object({
  byteLength: z.number().int().nonnegative().max(MAX_SANDBOX_FILE_BYTES),
  dataBase64: z.string(),
  filename: z.string().min(1),
  mediaType: z.string().min(1),
  path: z.string().startsWith(`${WORKSPACE_ROOT}/`),
});

export type SandboxFileDownload = z.output<typeof downloadSandboxFileOutputSchema>;

export function normalizeSandboxFilePath(input: string): SandboxFilePath {
  const result = sandboxFilePathSchema.safeParse(input);
  if (result.success) return result.data;

  throw new SandboxFileError({
    code: "invalid-path",
    message: result.error.issues[0]?.message ?? "Invalid sandbox file path.",
  });
}

export function getSandboxFileMetadata(path: SandboxFilePath): {
  readonly filename: string;
  readonly mediaType: string;
} {
  const filename = posix.basename(path);
  const extension = posix.extname(filename).toLowerCase();

  return {
    filename,
    mediaType: MEDIA_TYPES_BY_EXTENSION[extension] ?? "application/octet-stream",
  };
}

export async function downloadSandboxFile({
  path,
  sandbox,
}: {
  readonly path: SandboxFilePath;
  readonly sandbox: Pick<SandboxSession, "readFile">;
}): Promise<SandboxFileDownload> {
  let stream: ReadableStream<Uint8Array> | null;
  try {
    stream = await sandbox.readFile({ path });
  } catch {
    throw new SandboxFileError({ code: "unreadable", path });
  }

  if (stream === null) {
    throw new SandboxFileError({ code: "not-found", path });
  }

  let content: Uint8Array;
  try {
    content = await readSandboxFileStream(stream);
  } catch (error) {
    if (error instanceof SandboxFileError) throw error;
    throw new SandboxFileError({ code: "unreadable", path });
  }

  const metadata = getSandboxFileMetadata(path);
  return downloadSandboxFileOutputSchema.parse({
    byteLength: content.byteLength,
    dataBase64: Buffer.from(content).toString("base64"),
    filename: metadata.filename,
    mediaType: metadata.mediaType,
    path,
  });
}

async function readSandboxFileStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      byteLength += value.byteLength;
      if (byteLength > MAX_SANDBOX_FILE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new SandboxFileError({
          byteLength,
          code: "too-large",
          limit: MAX_SANDBOX_FILE_BYTES,
        });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const content = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return content;
}

function relativePathProblem(value: string): string | null {
  if (value.length === 0) return "Enter a file path.";
  if (value.trim() !== value) return "File paths cannot start or end with whitespace.";
  if (value.length > MAX_SANDBOX_PATH_LENGTH) return "The file path is too long.";
  if (WINDOWS_DRIVE_PREFIX.test(value)) {
    return "Use a path inside /workspace.";
  }
  if (value.includes("\\")) return "Use forward slashes in file paths.";
  if (CONTROL_CHARACTERS.test(value)) return "File paths cannot contain control characters.";

  const relativePath = value.startsWith(WORKSPACE_PREFIX)
    ? value.slice(WORKSPACE_PREFIX.length)
    : value;
  if (relativePath.startsWith("/")) return "Use a path inside /workspace.";

  const segments = relativePath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return "The file path must identify a file inside /workspace.";
  }

  return null;
}

function toAbsoluteWorkspacePath(path: string): string {
  return path.startsWith(WORKSPACE_PREFIX) ? path : `${WORKSPACE_PREFIX}${path}`;
}

function errorMessage(details: SandboxFileErrorDetails): string {
  switch (details.code) {
    case "invalid-path":
      return details.message;
    case "not-found":
      return `File not found: ${details.path}`;
    case "too-large":
      return `File is ${details.byteLength} bytes; the download limit is ${details.limit} bytes.`;
    case "unreadable":
      return `Path is not a readable file: ${details.path}`;
  }
}
