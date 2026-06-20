import { z } from "zod";

// Base64 expands files by roughly one third. Keep the encoded response below
// Vercel's 4.5 MB function payload limit.
export const MAX_SANDBOX_FILE_BYTES = 3 * 1024 * 1024;

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/iu;
const WORKSPACE_PREFIX = "/workspace/";

export const sandboxFilenameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine(
    (value) =>
      value !== "." &&
      value !== ".." &&
      !value.includes("/") &&
      !value.includes("\\") &&
      !CONTROL_CHARACTERS.test(value),
    "Filename must be a safe path leaf.",
  );

export const sandboxMediaTypeSchema = z.string().max(127).regex(MEDIA_TYPE_PATTERN);

const sandboxArtifactPathSchema = z
  .string()
  .max(1024)
  .refine(isSafeSandboxPath, "Path must identify a file inside /workspace.");

export const sandboxFileArtifactSchema = z
  .object({
    byteLength: z.number().int().nonnegative().max(MAX_SANDBOX_FILE_BYTES),
    dataBase64: z.string().regex(BASE64_PATTERN),
    filename: sandboxFilenameSchema,
    mediaType: sandboxMediaTypeSchema,
    path: sandboxArtifactPathSchema,
  })
  .refine(
    (artifact) => decodedBase64ByteLength(artifact.dataBase64) === artifact.byteLength,
    {
      message: "Base64 payload length does not match byteLength.",
      path: ["dataBase64"],
    },
  );

export type SandboxFileArtifact = z.output<typeof sandboxFileArtifactSchema>;

export const sandboxImageMediaTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const sandboxImageArtifactSchema = sandboxFileArtifactSchema.safeExtend({
  mediaType: sandboxImageMediaTypeSchema,
});

function isSafeSandboxPath(value: string): boolean {
  if (!value.startsWith(WORKSPACE_PREFIX) || CONTROL_CHARACTERS.test(value)) return false;
  return value
    .slice(WORKSPACE_PREFIX.length)
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function decodedBase64ByteLength(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}
