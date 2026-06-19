import { posix } from "node:path";
import { Readable } from "node:stream";
import type { SandboxSession } from "eve/sandbox";
import {
  MAX_SANDBOX_FILE_BYTES,
  type SandboxFileArtifact,
  type SandboxFilePath,
  sandboxFileArtifactSchema,
  sandboxFilePathSchema,
} from "../../lib/sandbox-files/contracts";

export {
  MAX_SANDBOX_FILE_BYTES,
  type SandboxFilePath,
  sandboxFilePathSchema,
};

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

export const downloadSandboxFileOutputSchema = sandboxFileArtifactSchema;

export type SandboxFileDownload = SandboxFileArtifact;

type SandboxFileReader = {
  readonly readFile: (
    options: Parameters<SandboxSession["readFile"]>[0],
  ) => PromiseLike<unknown>;
};

type SandboxFileStream = {
  readonly getReader: () => {
    readonly cancel: (reason?: unknown) => Promise<void>;
    readonly read: () => Promise<{ readonly done: boolean; readonly value?: unknown }>;
    readonly releaseLock: () => void;
  };
};

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
  readonly sandbox: SandboxFileReader;
}): Promise<SandboxFileDownload> {
  let stream: SandboxFileStream | null;
  try {
    stream = normalizeSandboxFileStream(await sandbox.readFile({ path }));
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

function normalizeSandboxFileStream(
  stream: unknown,
): SandboxFileStream | null {
  if (stream === null) return null;
  if (stream instanceof ReadableStream) return stream;
  if (stream instanceof Readable) return Readable.toWeb(stream);

  throw new TypeError("Sandbox returned an unsupported file stream.");
}

async function readSandboxFileStream(
  stream: SandboxFileStream,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw new TypeError("Sandbox file stream returned a non-byte chunk.");
      }

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
