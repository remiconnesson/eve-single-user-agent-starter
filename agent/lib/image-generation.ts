import { randomUUID } from "node:crypto";
import { gateway, generateImage } from "ai";
import type { SandboxSession } from "eve/sandbox";
import { z } from "zod";
import {
  MAX_SANDBOX_FILE_BYTES,
  sandboxImageArtifactSchema,
} from "../../lib/sandbox-files/contracts";

export const IMAGE_GENERATION_MODEL = "openai/gpt-image-2";
export const MAX_GENERATED_IMAGE_BYTES = MAX_SANDBOX_FILE_BYTES;

const imageSizeSchema = z.enum([
  "1024x1024",
  "1536x1024",
  "1024x1536",
]);

const generatedImageSchema = z.object({
  bytes: z
    .instanceof(Uint8Array)
    .refine((bytes) => bytes.byteLength > 0, "Generated image is empty."),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const imageGenerationInputSchema = z.object({
  filename: z.string().trim().min(1).max(120).optional(),
  prompt: z.string().trim().min(1).max(4_000),
  size: imageSizeSchema.optional(),
});

export const imageGenerationOutputSchema = sandboxImageArtifactSchema.safeExtend({
  model: z.literal(IMAGE_GENERATION_MODEL),
});

export type ImageGenerationInput = z.infer<typeof imageGenerationInputSchema>;
export type ImageGenerationOutput = z.infer<typeof imageGenerationOutputSchema>;
export type ImageGenerator = (
  input: Pick<ImageGenerationInput, "prompt" | "size">,
) => Promise<z.infer<typeof generatedImageSchema>>;

type SandboxWriter = Pick<SandboxSession, "writeBinaryFile">;

const extensionByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} satisfies Record<z.infer<typeof generatedImageSchema>["mimeType"], string>;

export function sanitizeImageFilename({
  fallbackId,
  filename,
  mimeType,
}: {
  fallbackId: string;
  filename?: string;
  mimeType: z.infer<typeof generatedImageSchema>["mimeType"];
}): string {
  const leaf = filename?.split(/[\\/]/).at(-1) ?? "";
  const withoutExtension = leaf.replace(/\.[^.]*$/, "");
  const safeBase = withoutExtension
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const fallback = `image-${fallbackId}`
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 80);

  return `${safeBase || fallback}.${extensionByMimeType[mimeType]}`;
}

export async function generateImageWithGateway(
  input: Pick<ImageGenerationInput, "prompt" | "size">,
): Promise<z.infer<typeof generatedImageSchema>> {
  const result = await generateImage({
    model: gateway.image(IMAGE_GENERATION_MODEL),
    prompt: input.prompt,
    providerOptions: {
      openai: {
        output_compression: 70,
        output_format: "webp",
        // Image generation can otherwise leave the HTTP event stream idle long
        // enough for a browser or proxy to disconnect before the tool returns.
        quality: "low",
      },
    },
    ...(input.size ? { size: input.size } : {}),
  });

  return generatedImageSchema.parse({
    bytes: result.image.uint8Array,
    mimeType: result.image.mediaType,
  });
}

export async function generateImageInSandbox({
  generate = generateImageWithGateway,
  id = randomUUID,
  input,
  sandbox,
}: {
  generate?: ImageGenerator;
  id?: () => string;
  input: ImageGenerationInput;
  sandbox: SandboxWriter;
}): Promise<ImageGenerationOutput> {
  const parsedInput = imageGenerationInputSchema.parse(input);
  const generated = generatedImageSchema.parse(await generate(parsedInput));
  if (generated.bytes.byteLength > MAX_GENERATED_IMAGE_BYTES) {
    throw new Error(
      `Generated image exceeds the ${MAX_GENERATED_IMAGE_BYTES}-byte limit.`,
    );
  }
  const filename = sanitizeImageFilename({
    fallbackId: id(),
    filename: parsedInput.filename,
    mimeType: generated.mimeType,
  });
  const path = `/workspace/generated/${filename}`;

  await sandbox.writeBinaryFile({
    content: generated.bytes,
    path,
  });

  return imageGenerationOutputSchema.parse({
    byteLength: generated.bytes.byteLength,
    dataBase64: Buffer.from(generated.bytes).toString("base64"),
    filename,
    mediaType: generated.mimeType,
    model: IMAGE_GENERATION_MODEL,
    path,
  });
}
