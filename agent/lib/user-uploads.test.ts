import { describe, expect, it, vi } from "vitest";
import {
  USER_UPLOADS_AUTH_ATTRIBUTE,
  currentUserUploads,
  extractUserUploads,
  renderUserUploadInstructions,
  syncUserUploadOriginals,
  userUploadPaths,
  withUserUploads,
} from "./user-uploads";

const hello = {
  byteLength: 5,
  filename: "notes.txt",
  hash: "2cf24dba5fb0a30e",
  mediaType: "text/plain",
} as const;

describe("user upload contracts", () => {
  it("derives content-addressed paths from inline files", async () => {
    const uploads = await extractUserUploads([
      { text: "Read both", type: "text" },
      {
        data: "data:text/plain;base64,aGVsbG8=",
        filename: "notes (final).txt",
        mediaType: "text/plain",
        type: "file",
      },
    ]);

    expect(uploads).toEqual([{ ...hello, filename: "notes_final_.txt" }]);
    expect(userUploadPaths(uploads[0])).toEqual({
      copy:
        "/workspace/user_uploads/copies/2cf24dba5fb0a30e--notes_final_.txt",
      original:
        "/workspace/user_uploads/originals/2cf24dba5fb0a30e--notes_final_.txt",
      staged: "/workspace/attachments/2cf24dba5fb0a30e/notes_final_.txt",
    });
  });

  it("round-trips the current upload manifest through authenticated attributes", () => {
    const auth = {
      attributes: { role: "owner" },
      authenticator: "test",
      principalId: "owner",
      principalType: "user",
    };
    const enriched = withUserUploads(auth, [hello]);

    expect(enriched?.attributes[USER_UPLOADS_AUTH_ATTRIBUTE]).toBe(
      JSON.stringify([hello]),
    );
    expect(currentUserUploads(enriched)).toEqual([hello]);
    expect(
      currentUserUploads({
        ...auth,
        attributes: { [USER_UPLOADS_AUTH_ATTRIBUTE]: "not-json" },
      }),
    ).toEqual([]);
  });

  it("copies a staged file once and never overwrites the immutable original", async () => {
    const files = new Map<string, Uint8Array>([
      [userUploadPaths(hello).staged, Buffer.from("hello")],
    ]);
    const writeBinaryFile = vi.fn(async ({ content, path }) => {
      files.set(path, content);
    });
    const writeTextFile = vi.fn(async () => undefined);
    const sandbox = {
      readBinaryFile: async ({ path }: { readonly path: string }) =>
        files.get(path) ?? null,
      readTextFile: async () => null,
      writeBinaryFile,
      writeTextFile,
    };

    await syncUserUploadOriginals({ current: [hello], sandbox });
    await syncUserUploadOriginals({ current: [hello], sandbox });

    expect(writeBinaryFile).toHaveBeenCalledTimes(1);
    expect(writeBinaryFile).toHaveBeenCalledWith({
      content: Buffer.from("hello"),
      path: userUploadPaths(hello).original,
    });
    expect(writeTextFile).toHaveBeenCalledTimes(2);
  });

  it("fails closed when an immutable original no longer matches its hash", async () => {
    const paths = userUploadPaths(hello);
    const sandbox = {
      readBinaryFile: async ({ path }: { readonly path: string }) =>
        path === paths.original ? Buffer.from("changed") : null,
      readTextFile: async () => null,
      writeBinaryFile: vi.fn(async () => undefined),
      writeTextFile: vi.fn(async () => undefined),
    };

    await expect(
      syncUserUploadOriginals({ current: [hello], sandbox }),
    ).rejects.toThrow("integrity check failed");
    expect(sandbox.writeBinaryFile).not.toHaveBeenCalled();
  });

  it("instructs the model to preserve originals and edit exact copy paths", () => {
    const instructions = renderUserUploadInstructions([hello]);

    expect(instructions).toContain(userUploadPaths(hello).original);
    expect(instructions).toContain(userUploadPaths(hello).copy);
    expect(instructions).toContain("Never edit, rename, move, or delete an original");
    expect(instructions).toContain("create the parent directory and copy");
    expect(instructions).toContain("continue editing it without replacing it");
    expect(instructions).toContain("Ignore transient files");
  });
});
