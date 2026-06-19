import type { FilePart, UserContent } from "ai";
import {
  MAX_USER_UPLOAD_FILE_BYTES,
  MAX_USER_UPLOAD_FILES,
  MAX_USER_UPLOAD_TOTAL_BYTES,
} from "@/lib/user-uploads/constants";

// The file becomes base64 inside Eve's JSON request and tool result.
export const MAX_SANDBOX_FILE_BYTES = 3 * 1024 * 1024;
const BASE64_CHUNK_SIZE = 32_768;
const INLINE_IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface SandboxFileArtifact {
  readonly byteLength: number;
  readonly dataBase64: string;
  readonly filename: string;
  readonly mediaType: string;
  readonly path: string;
}

export async function createSandboxFileMessage({
  files,
  text,
}: {
  readonly files: readonly File[];
  readonly text: string;
}): Promise<UserContent> {
  const instruction = text.trim();
  if (!instruction) throw new Error("Enter a message before sending uploaded files.");
  validateUserUploadFiles(files);

  const fileParts = await Promise.all(
    files.map(async (file): Promise<FilePart> => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const filename = sanitizeUploadFilename(file.name);
      const mediaType = isValidMediaType(file.type)
        ? file.type
        : "application/octet-stream";
      return {
        data: `data:${mediaType};base64,${bytesToBase64(bytes)}`,
        filename,
        mediaType,
        type: "file",
      };
    }),
  );

  return [{ text: instruction, type: "text" }, ...fileParts];
}

export function validateUserUploadFiles(files: readonly File[]): void {
  if (files.length > MAX_USER_UPLOAD_FILES) {
    throw new Error(`Add up to ${MAX_USER_UPLOAD_FILES} files at a time.`);
  }

  let totalBytes = 0;
  for (const file of files) {
    if (file.size > MAX_USER_UPLOAD_FILE_BYTES) {
      throw new Error(`"${file.name || "File"}" must be 1 MiB or smaller.`);
    }
    totalBytes += file.size;
  }
  if (totalBytes > MAX_USER_UPLOAD_TOTAL_BYTES) {
    throw new Error("Files must be 3 MiB or smaller in total.");
  }
}

export function mergeUserUploadFiles(
  current: readonly File[],
  selected: readonly File[],
): File[] {
  const files = new Map<string, File>();
  for (const file of [...current, ...selected]) {
    files.set(`${file.name}:${file.size}:${file.lastModified}:${file.type}`, file);
  }
  const merged = [...files.values()];
  validateUserUploadFiles(merged);
  return merged;
}

export function parseDownloadFileOutput(output: unknown): SandboxFileArtifact | null {
  return parseSandboxFileArtifact(output, { imageOnly: false, requireFilename: true });
}

export function parseGeneratedImageOutput(output: unknown): SandboxFileArtifact | null {
  return parseSandboxFileArtifact(output, { imageOnly: true, requireFilename: false });
}

export function sandboxFileDataUrl(artifact: SandboxFileArtifact): string {
  return `data:${artifact.mediaType};base64,${artifact.dataBase64}`;
}

function parseSandboxFileArtifact(
  output: unknown,
  options: { readonly imageOnly: boolean; readonly requireFilename: boolean },
): SandboxFileArtifact | null {
  if (typeof output !== "object" || output === null) return null;
  if (!("byteLength" in output) || !isValidByteLength(output.byteLength)) return null;
  if (!("dataBase64" in output) || typeof output.dataBase64 !== "string") return null;
  if (!("mediaType" in output) || !isValidMediaType(output.mediaType)) return null;
  if (!("path" in output) || !isValidSandboxPath(output.path)) return null;
  if (options.imageOnly && !INLINE_IMAGE_MEDIA_TYPES.has(output.mediaType)) return null;
  if (decodedBase64ByteLength(output.dataBase64) !== output.byteLength) return null;

  const providedFilename = "filename" in output ? output.filename : undefined;
  if (options.requireFilename && !isValidFilename(providedFilename)) return null;
  if (providedFilename !== undefined && !isValidFilename(providedFilename)) return null;

  return {
    byteLength: output.byteLength,
    dataBase64: output.dataBase64,
    filename:
      typeof providedFilename === "string" ? providedFilename : filenameFromPath(output.path),
    mediaType: output.mediaType,
    path: output.path,
  };
}

function isValidByteLength(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_SANDBOX_FILE_BYTES
  );
}

function isValidFilename(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function sanitizeUploadFilename(value: string): string {
  const basename = value.split("/").at(-1)?.split("\\").at(-1) ?? "";
  const safe = basename.replace(/[^\w.-]+/gu, "_");
  return isValidFilename(safe) && safe !== "." && safe !== ".." ? safe : "upload";
}

function isValidMediaType(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 127 &&
    /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/iu.test(value)
  );
}

function isValidSandboxPath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/workspace/") ||
    value.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return false;
  }

  const segments = value.slice("/workspace/".length).split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function decodedBase64ByteLength(value: string): number | null {
  if (value.length === 0) return 0;
  if (
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
  ) {
    return null;
  }

  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

function filenameFromPath(path: string): string {
  const filename = path.split("/").at(-1);
  return filename && isValidFilename(filename) ? filename : "generated-image";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}
