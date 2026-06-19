import type { FilePart, FileUIPart, UserContent } from "ai";

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
  file,
  text,
}: {
  readonly file: FileUIPart;
  readonly text: string;
}): Promise<UserContent> {
  const response = await fetch(file.url);
  if (!response.ok) {
    throw new Error("The selected file could not be read.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_SANDBOX_FILE_BYTES) {
    throw new Error("Files uploaded to the sandbox must be 3 MiB or smaller.");
  }

  const candidateFilename = file.filename?.trim();
  const filename = isValidFilename(candidateFilename) ? candidateFilename : "upload";
  const candidateMediaType = file.mediaType?.trim();
  const mediaType = isValidMediaType(candidateMediaType)
    ? candidateMediaType
    : "application/octet-stream";
  const instruction =
    text.trim() || `Use the uploaded file "${filename}" from the sandbox and confirm its path.`;

  const filePart = {
    data: `data:${mediaType};base64,${bytesToBase64(bytes)}`,
    filename,
    mediaType,
    type: "file",
  } satisfies FilePart;

  return [{ text: instruction, type: "text" }, filePart];
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
