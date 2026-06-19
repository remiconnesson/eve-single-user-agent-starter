import { describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({
  generateImage: vi.fn(),
  imageModel: vi.fn(),
}));

vi.mock("ai", () => ({
  gateway: { image: aiMocks.imageModel },
  generateImage: aiMocks.generateImage,
}));

import {
  IMAGE_GENERATION_MODEL,
  MAX_GENERATED_IMAGE_BYTES,
  generateImageInSandbox,
  generateImageWithGateway,
  imageGenerationInputSchema,
  sanitizeImageFilename,
} from "./image-generation";

describe("image generation", () => {
  it("uses GPT Image 2 through AI Gateway", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const model = { id: IMAGE_GENERATION_MODEL };
    aiMocks.imageModel.mockReturnValue(model);
    aiMocks.generateImage.mockResolvedValue({
      image: { mediaType: "image/png", uint8Array: bytes },
    });

    await expect(
      generateImageWithGateway({ prompt: "A diagram", size: "1024x1024" }),
    ).resolves.toEqual({ bytes, mimeType: "image/png" });
    expect(aiMocks.imageModel).toHaveBeenCalledWith(IMAGE_GENERATION_MODEL);
    expect(aiMocks.generateImage).toHaveBeenCalledWith({
      model,
      prompt: "A diagram",
      providerOptions: {
        openai: {
          output_compression: 70,
          output_format: "webp",
          quality: "low",
        },
      },
      size: "1024x1024",
    });
  });

  it("accepts only GPT Image 2 supported sizes and bounded input", () => {
    expect(
      imageGenerationInputSchema.parse({
        filename: "cover.png",
        prompt: "A geometric black and white cover",
        size: "1536x1024",
      }),
    ).toEqual({
      filename: "cover.png",
      prompt: "A geometric black and white cover",
      size: "1536x1024",
    });
    expect(() =>
      imageGenerationInputSchema.parse({ prompt: "test", size: "512x512" }),
    ).toThrow();
    expect(() => imageGenerationInputSchema.parse({ prompt: "" })).toThrow();
  });

  it("removes path traversal and replaces the extension from the media type", () => {
    expect(
      sanitizeImageFilename({
        fallbackId: "unused",
        filename: "../../My cover.exe",
        mimeType: "image/png",
      }),
    ).toBe("My-cover.png");
    expect(
      sanitizeImageFilename({
        fallbackId: "fixed-id",
        filename: "../..",
        mimeType: "image/webp",
      }),
    ).toBe("image-fixed-id.webp");
  });

  it("generates through an injectable helper and writes bytes to the sandbox", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const generate = vi.fn().mockResolvedValue({
      bytes,
      mimeType: "image/png",
    });
    const writeBinaryFile = vi.fn().mockResolvedValue(undefined);

    const result = await generateImageInSandbox({
      generate,
      id: () => "fixed-id",
      input: {
        prompt: "A small test image",
        size: "1024x1024",
      },
      sandbox: { writeBinaryFile },
    });

    expect(generate).toHaveBeenCalledWith({
      prompt: "A small test image",
      size: "1024x1024",
    });
    expect(writeBinaryFile).toHaveBeenCalledWith({
      content: bytes,
      path: "/workspace/generated/image-fixed-id.png",
    });
    expect(result).toEqual({
      byteLength: 4,
      dataBase64: "iVBORw==",
      filename: "image-fixed-id.png",
      mediaType: "image/png",
      model: IMAGE_GENERATION_MODEL,
      path: "/workspace/generated/image-fixed-id.png",
    });
  });

  it("rejects invalid generated media before writing it", async () => {
    const writeBinaryFile = vi.fn();

    await expect(
      generateImageInSandbox({
        generate: vi.fn().mockResolvedValue({
          bytes: new Uint8Array([1]),
          mimeType: "text/plain",
        }),
        input: { prompt: "test" },
        sandbox: { writeBinaryFile },
      }),
    ).rejects.toThrow();
    expect(writeBinaryFile).not.toHaveBeenCalled();
  });

  it("rejects an oversized generated image before writing it", async () => {
    const writeBinaryFile = vi.fn();

    await expect(
      generateImageInSandbox({
        generate: vi.fn().mockResolvedValue({
          bytes: new Uint8Array(MAX_GENERATED_IMAGE_BYTES + 1),
          mimeType: "image/png",
        }),
        input: { prompt: "test" },
        sandbox: { writeBinaryFile },
      }),
    ).rejects.toThrow("exceeds");
    expect(writeBinaryFile).not.toHaveBeenCalled();
  });
});
