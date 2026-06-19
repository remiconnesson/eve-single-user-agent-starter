import { describe, expect, it } from "vitest";
import {
  createSandboxFileMessage,
  parseDownloadFileOutput,
  parseGeneratedImageOutput,
} from "./sandbox-file";

describe("createSandboxFileMessage", () => {
  it("builds an Eve turn with text and one inline file", async () => {
    const message = await createSandboxFileMessage({
      file: {
        filename: "notes.txt",
        mediaType: "text/plain",
        type: "file",
        url: "data:text/plain;base64,aGVsbG8=",
      },
      text: "Summarize this file",
    });

    expect(message).toEqual([
      { text: "Summarize this file", type: "text" },
      {
        data: "data:text/plain;base64,aGVsbG8=",
        filename: "notes.txt",
        mediaType: "text/plain",
        type: "file",
      },
    ]);
  });

  it("rejects files above 3 MiB", async () => {
    const oversized = new Uint8Array(3 * 1024 * 1024 + 1);
    const data = Buffer.from(oversized).toString("base64");

    await expect(
      createSandboxFileMessage({
        file: {
          filename: "too-large.bin",
          mediaType: "application/octet-stream",
          type: "file",
          url: `data:application/octet-stream;base64,${data}`,
        },
        text: "Upload this file",
      }),
    ).rejects.toThrow("3 MiB");
  });
});

describe("sandbox tool output parsing", () => {
  const bytes = Buffer.from("hello").toString("base64");

  it("accepts a complete download_file result", () => {
    expect(
      parseDownloadFileOutput({
        byteLength: 5,
        dataBase64: bytes,
        filename: "report.txt",
        mediaType: "text/plain",
        path: "/workspace/report.txt",
      }),
    ).toMatchObject({ filename: "report.txt", path: "/workspace/report.txt" });
  });

  it("accepts image bytes from generate_image", () => {
    expect(
      parseGeneratedImageOutput({
        byteLength: 5,
        dataBase64: bytes,
        mediaType: "image/png",
        path: "/workspace/image.png",
      }),
    ).toMatchObject({ mediaType: "image/png", path: "/workspace/image.png" });
  });

  it("rejects malformed base64 and mismatched byte lengths", () => {
    expect(
      parseDownloadFileOutput({
        byteLength: 6,
        dataBase64: bytes,
        filename: "report.txt",
        mediaType: "text/plain",
        path: "/workspace/report.txt",
      }),
    ).toBeNull();
    expect(
      parseGeneratedImageOutput({
        byteLength: 3,
        dataBase64: "not base64",
        mediaType: "image/png",
        path: "/workspace/image.png",
      }),
    ).toBeNull();
  });
});
