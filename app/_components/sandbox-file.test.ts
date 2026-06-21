import { describe, expect, it } from "vitest";
import {
  createSandboxFileMessage,
  parseDownloadFileOutput,
  parseGeneratedImageOutput,
  validateUserUploadFiles,
} from "./sandbox-file";

describe("createSandboxFileMessage", () => {
  it("builds one eve turn with text and several inline files", async () => {
    const message = await createSandboxFileMessage({
      files: [
        new File(["hello"], "notes.txt", { type: "text/plain" }),
        new File(["{}"], "data.json", { type: "application/json" }),
      ],
      text: "Summarize this file",
    });

    expect(message).toHaveLength(3);
    expect(message[0]).toEqual({ text: "Summarize this file", type: "text" });
    expect(message[1]).toMatchObject({
      data: "data:text/plain;base64,aGVsbG8=",
      filename: "notes.txt",
      mediaType: "text/plain",
      type: "file",
    });
    expect(message[2]).toMatchObject({
      data: "data:application/json;base64,e30=",
      filename: "data.json",
      mediaType: "application/json",
      type: "file",
    });
  });

  it("rejects files above 1 MiB", async () => {
    const oversized = new Uint8Array(1024 * 1024 + 1);

    await expect(
      createSandboxFileMessage({
        files: [
          new File([oversized], "too-large.bin", {
            type: "application/octet-stream",
          }),
        ],
        text: "Upload this file",
      }),
    ).rejects.toThrow("1 MiB");
  });

  it("requires a real prompt instead of creating a file-only turn", async () => {
    await expect(
      createSandboxFileMessage({
        files: [new File(["hello"], "notes.txt", { type: "text/plain" })],
        text: "",
      }),
    ).rejects.toThrow("Enter a message");
  });

  it("bounds multi-file request count and combined size", () => {
    expect(() =>
      validateUserUploadFiles(
        Array.from(
          { length: 6 },
          (_, index) => new File([String(index)], `${index}.txt`),
        ),
      ),
    ).toThrow("up to 5 files");

    expect(() =>
      validateUserUploadFiles(
        Array.from(
          { length: 4 },
          (_, index) => new File([new Uint8Array(800 * 1024)], `${index}.bin`),
        ),
      ),
    ).toThrow("3 MiB");
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
