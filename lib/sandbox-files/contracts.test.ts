import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  MAX_SANDBOX_FILE_BYTES,
  legacySandboxImageArtifactSchema,
  sandboxFileArtifactSchema,
  sandboxImageArtifactSchema,
} from "./contracts";

function artifact(overrides: Record<string, unknown> = {}) {
  return {
    byteLength: 5,
    dataBase64: Buffer.from("hello").toString("base64"),
    filename: "report.txt",
    mediaType: "text/plain",
    path: "/workspace/report.txt",
    ...overrides,
  };
}

describe("sandbox file artifact contracts", () => {
  it("accepts empty files and the maximum payload size", () => {
    expect(
      sandboxFileArtifactSchema.safeParse(
        artifact({ byteLength: 0, dataBase64: "", filename: "empty.txt" }),
      ).success,
    ).toBe(true);

    const maximum = Buffer.alloc(MAX_SANDBOX_FILE_BYTES).toString("base64");
    expect(
      sandboxFileArtifactSchema.safeParse(
        artifact({ byteLength: MAX_SANDBOX_FILE_BYTES, dataBase64: maximum }),
      ).success,
    ).toBe(true);
  });

  it("rejects oversized, malformed, and length-mismatched base64", () => {
    const oversizedBytes = MAX_SANDBOX_FILE_BYTES + 1;
    expect(
      sandboxFileArtifactSchema.safeParse(
        artifact({
          byteLength: oversizedBytes,
          dataBase64: Buffer.alloc(oversizedBytes).toString("base64"),
        }),
      ).success,
    ).toBe(false);
    expect(
      sandboxFileArtifactSchema.safeParse(artifact({ dataBase64: "not base64" })).success,
    ).toBe(false);
    expect(
      sandboxFileArtifactSchema.safeParse(artifact({ byteLength: 6 })).success,
    ).toBe(false);
  });

  it.each([
    ["unsafe filename", { filename: "../report.txt" }],
    ["unsafe media type", { mediaType: "text plain" }],
    ["relative output path", { path: "report.txt" }],
    ["traversing output path", { path: "/workspace/reports/../report.txt" }],
    ["backslash output path", { path: "/workspace/reports\\report.txt" }],
  ])("rejects %s", (_label, overrides) => {
    expect(sandboxFileArtifactSchema.safeParse(artifact(overrides)).success).toBe(false);
  });

  it("keeps image artifacts explicit and non-empty", () => {
    expect(
      sandboxImageArtifactSchema.safeParse(
        artifact({ filename: "image.png", mediaType: "image/png", path: "/workspace/image.png" }),
      ).success,
    ).toBe(true);
    expect(
      sandboxImageArtifactSchema.safeParse(
        artifact({ byteLength: 0, dataBase64: "", filename: "image.png", mediaType: "image/png" }),
      ).success,
    ).toBe(false);
    expect(
      sandboxImageArtifactSchema.safeParse(
        artifact({ filename: "image.svg", mediaType: "image/svg+xml" }),
      ).success,
    ).toBe(false);
  });

  it("normalizes the legacy generated-image shape without weakening filenames", () => {
    const legacy = artifact({
      filename: undefined,
      mediaType: "image/png",
      model: "openai/gpt-image-2",
      path: "/workspace/generated/image.png",
    });

    expect(legacySandboxImageArtifactSchema.parse(legacy)).toEqual({
      byteLength: 5,
      dataBase64: Buffer.from("hello").toString("base64"),
      filename: "image.png",
      mediaType: "image/png",
      path: "/workspace/generated/image.png",
    });
    expect(
      legacySandboxImageArtifactSchema.safeParse({
        ...legacy,
        filename: "../image.png",
      }).success,
    ).toBe(false);
  });
});
