import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  MAX_SANDBOX_FILE_BYTES,
  SandboxFileError,
  downloadSandboxFile,
  normalizeSandboxFilePath,
  sandboxFilePathSchema,
} from "./sandbox-files";

function fileStream(...chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe("normalizeSandboxFilePath", () => {
  it("anchors a relative path under /workspace", () => {
    expect(normalizeSandboxFilePath("reports/output.csv")).toBe(
      "/workspace/reports/output.csv",
    );
  });

  it("accepts an absolute path already rooted at /workspace", () => {
    expect(normalizeSandboxFilePath("/workspace/generated/image.png")).toBe(
      "/workspace/generated/image.png",
    );
  });

  it.each([
    "",
    " ",
    "/etc/passwd",
    "/workspace",
    "/workspace/../etc/passwd",
    "/workspace/generated//image.png",
    "/workspace/generated/./image.png",
    "../secret.txt",
    "reports/../../secret.txt",
    "reports/./output.csv",
    "reports//output.csv",
    "reports/",
    "reports\\output.csv",
    "reports/\0output.csv",
  ])("rejects unsafe or directory-like path %j", (path) => {
    expect(() => normalizeSandboxFilePath(path)).toThrow(SandboxFileError);
    expect(sandboxFilePathSchema.safeParse(path).success).toBe(false);
  });
});

describe("downloadSandboxFile", () => {
  it("returns a browser-safe file contract", async () => {
    const content = Buffer.from("hello");
    const result = await downloadSandboxFile({
      path: normalizeSandboxFilePath("reports/hello.txt"),
      sandbox: {
        readFile: async () => fileStream(content.subarray(0, 2), content.subarray(2)),
      },
    });

    expect(result).toEqual({
      byteLength: 5,
      dataBase64: content.toString("base64"),
      filename: "hello.txt",
      mediaType: "text/plain",
      path: "/workspace/reports/hello.txt",
    });
  });

  it("adapts Vercel's Node file stream to the download contract", async () => {
    const content = Buffer.from("vercel stream");
    const result = await downloadSandboxFile({
      path: normalizeSandboxFilePath("reports/vercel.txt"),
      sandbox: {
        readFile: async () => Readable.from([content]),
      },
    });

    expect(result).toMatchObject({
      byteLength: content.byteLength,
      dataBase64: content.toString("base64"),
      filename: "vercel.txt",
      mediaType: "text/plain",
    });
  });

  it("uses a binary media type for unknown extensions", async () => {
    const result = await downloadSandboxFile({
      path: normalizeSandboxFilePath("archive.unknown"),
      sandbox: {
        readFile: async () => fileStream(Buffer.from([0, 1, 2])),
      },
    });

    expect(result.mediaType).toBe("application/octet-stream");
  });

  it("rejects missing files", async () => {
    const promise = downloadSandboxFile({
      path: normalizeSandboxFilePath("missing.txt"),
      sandbox: {
        readFile: async () => null,
      },
    });

    await expect(promise).rejects.toMatchObject({ code: "not-found" });
  });

  it("rejects files over the download limit", async () => {
    const promise = downloadSandboxFile({
      path: normalizeSandboxFilePath("large.bin"),
      sandbox: {
        readFile: async () =>
          fileStream(new Uint8Array(MAX_SANDBOX_FILE_BYTES), new Uint8Array(1)),
      },
    });

    await expect(promise).rejects.toMatchObject({
      code: "too-large",
      limit: MAX_SANDBOX_FILE_BYTES,
    });
  });
});
