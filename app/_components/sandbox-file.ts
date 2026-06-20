import type { FilePart, UserContent } from "ai";
import {
  MAX_USER_UPLOAD_FILE_BYTES,
  MAX_USER_UPLOAD_FILES,
  MAX_USER_UPLOAD_TOTAL_BYTES,
} from "@/lib/user-uploads/constants";
import {
  type SandboxFileArtifact,
  sandboxFileArtifactSchema,
  sandboxFilenameSchema,
  sandboxImageArtifactSchema,
  sandboxImageMediaTypeSchema,
  sandboxMediaTypeSchema,
} from "@/lib/sandbox-files/contracts";

const BASE64_CHUNK_SIZE = 32_768;

export type { SandboxFileArtifact };

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
      const parsedMediaType = sandboxMediaTypeSchema.safeParse(file.type);
      const mediaType = parsedMediaType.success
        ? parsedMediaType.data
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
  const parsed = sandboxFileArtifactSchema.safeParse(output);
  return parsed.success ? parsed.data : null;
}

export function parseGeneratedImageOutput(output: unknown): SandboxFileArtifact | null {
  const parsed = sandboxImageArtifactSchema.safeParse(
    withGeneratedImageFilename(output),
  );
  return parsed.success ? parsed.data : null;
}

export function isSandboxImageArtifact(artifact: SandboxFileArtifact): boolean {
  return sandboxImageMediaTypeSchema.safeParse(artifact.mediaType).success;
}

export function sandboxFileDataUrl(artifact: SandboxFileArtifact): string {
  return `data:${artifact.mediaType};base64,${artifact.dataBase64}`;
}

function sanitizeUploadFilename(value: string): string {
  const basename = value.split("/").at(-1)?.split("\\").at(-1) ?? "";
  const safe = basename.replace(/[^\w.-]+/gu, "_");
  const parsed = sandboxFilenameSchema.safeParse(safe);
  return parsed.success ? parsed.data : "upload";
}

function withGeneratedImageFilename(output: unknown): unknown {
  if (
    !isRecord(output) ||
    typeof output.path !== "string" ||
    output.filename !== undefined
  ) {
    return output;
  }

  return { ...output, filename: filenameFromPath(output.path) };
}

function filenameFromPath(path: string): string {
  const parsed = sandboxFilenameSchema.safeParse(path.split("/").at(-1));
  return parsed.success ? parsed.data : "generated-image";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}
