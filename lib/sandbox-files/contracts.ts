import { z } from "zod";

// Base64 expands files by roughly one third. Keep the encoded response below
// Vercel's 4.5 MB function payload limit.
export const MAX_SANDBOX_FILE_BYTES = 3 * 1024 * 1024;

const MAX_BASE64_LENGTH = Math.ceil(MAX_SANDBOX_FILE_BYTES / 3) * 4;
const MAX_SANDBOX_PATH_LENGTH = 1024;
const WORKSPACE_ROOT = "/workspace";
const WORKSPACE_PREFIX = `${WORKSPACE_ROOT}/`;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/iu;
const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:/u;

const sandboxByteLengthSchema = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_SANDBOX_FILE_BYTES);
export const standardBase64Schema = z.string().regex(BASE64_PATTERN);
const sandboxBase64Schema = standardBase64Schema.max(MAX_BASE64_LENGTH);

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

export const sandboxMediaTypeSchema = z
  .string()
  .min(1)
  .max(127)
  .regex(MEDIA_TYPE_PATTERN);

const sandboxImageMediaTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const sandboxFileInputPathSchema = z.string().superRefine((value, context) => {
  const problem = relativePathProblem(value);
  if (problem === null) return;

  context.addIssue({ code: "custom", message: problem });
});

export const sandboxFilePathSchema = sandboxFileInputPathSchema
  .transform(toAbsoluteWorkspacePath)
  .brand<"SandboxFilePath">();

export type SandboxFilePath = z.output<typeof sandboxFilePathSchema>;

export const sandboxArtifactPathSchema = z.string().superRefine((value, context) => {
  const problem = absoluteWorkspacePathProblem(value);
  if (problem === null) return;

  context.addIssue({ code: "custom", message: problem });
});

const sandboxFileArtifactShape = {
  byteLength: sandboxByteLengthSchema,
  dataBase64: sandboxBase64Schema,
  filename: sandboxFilenameSchema,
  mediaType: sandboxMediaTypeSchema,
  path: sandboxArtifactPathSchema,
};

export const sandboxFileArtifactSchema = z
  .object(sandboxFileArtifactShape)
  .superRefine(validateEncodedByteLength);

export type SandboxFileArtifact = z.output<typeof sandboxFileArtifactSchema>;

export const sandboxImageArtifactSchema = z
  .object({
    ...sandboxFileArtifactShape,
    byteLength: sandboxByteLengthSchema.positive(),
    mediaType: sandboxImageMediaTypeSchema,
  })
  .superRefine(validateEncodedByteLength);

export type SandboxImageArtifact = z.output<typeof sandboxImageArtifactSchema>;

export const legacySandboxImageArtifactSchema = z
  .object({
    ...sandboxFileArtifactShape,
    byteLength: sandboxByteLengthSchema.positive(),
    filename: sandboxFilenameSchema.optional(),
    mediaType: sandboxImageMediaTypeSchema,
  })
  .superRefine(validateEncodedByteLength)
  .transform((artifact): SandboxImageArtifact => ({
    ...artifact,
    filename: artifact.filename ?? filenameFromPath(artifact.path),
  }));

function validateEncodedByteLength(
  artifact: { readonly byteLength: number; readonly dataBase64: string },
  context: z.RefinementCtx,
): void {
  if (decodedBase64ByteLength(artifact.dataBase64) === artifact.byteLength) return;

  context.addIssue({
    code: "custom",
    message: "Base64 payload length does not match byteLength.",
    path: ["dataBase64"],
  });
}

function relativePathProblem(value: string): string | null {
  if (value.length === 0) return "Enter a file path.";
  if (value.trim() !== value) return "File paths cannot start or end with whitespace.";
  if (value.length > MAX_SANDBOX_PATH_LENGTH) return "The file path is too long.";
  if (WINDOWS_DRIVE_PREFIX.test(value)) return "Use a path inside /workspace.";
  if (value.includes("\\")) return "Use forward slashes in file paths.";
  if (CONTROL_CHARACTERS.test(value)) return "File paths cannot contain control characters.";

  const relativePath = value.startsWith(WORKSPACE_PREFIX)
    ? value.slice(WORKSPACE_PREFIX.length)
    : value;
  if (relativePath.startsWith("/")) return "Use a path inside /workspace.";
  if (hasUnsafePathSegment(relativePath)) {
    return "The file path must identify a file inside /workspace.";
  }

  return null;
}

function absoluteWorkspacePathProblem(value: string): string | null {
  if (!value.startsWith(WORKSPACE_PREFIX)) return "Use an absolute path inside /workspace.";
  if (value.length > MAX_SANDBOX_PATH_LENGTH) return "The file path is too long.";
  if (value.includes("\\")) return "Use forward slashes in file paths.";
  if (CONTROL_CHARACTERS.test(value)) return "File paths cannot contain control characters.";
  if (hasUnsafePathSegment(value.slice(WORKSPACE_PREFIX.length))) {
    return "The file path must identify a file inside /workspace.";
  }

  return null;
}

function hasUnsafePathSegment(relativePath: string): boolean {
  return relativePath
    .split("/")
    .some((segment) => segment === "" || segment === "." || segment === "..");
}

function toAbsoluteWorkspacePath(path: string): string {
  return path.startsWith(WORKSPACE_PREFIX) ? path : `${WORKSPACE_PREFIX}${path}`;
}

function decodedBase64ByteLength(value: string): number {
  if (value.length === 0) return 0;

  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

function filenameFromPath(path: string): string {
  const filename = path.split("/").at(-1);
  const parsed = sandboxFilenameSchema.safeParse(filename);
  return parsed.success ? parsed.data : "generated-image";
}
