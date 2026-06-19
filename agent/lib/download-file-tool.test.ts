import { describe, expect, it } from "vitest";
import downloadFileTool from "../tools/download_file";

describe("download_file", () => {
  it("keeps file bytes out of the model-facing result", async () => {
    const projectForModel = downloadFileTool.toModelOutput;
    if (!projectForModel) throw new Error("download_file must define toModelOutput");

    const output = await projectForModel({
      byteLength: 5,
      dataBase64: "aGVsbG8=",
      filename: "hello.txt",
      mediaType: "text/plain",
      path: "/workspace/hello.txt",
    });

    expect(output).toEqual({
      type: "text",
      value: "Prepared /workspace/hello.txt (5 bytes) for download.",
    });
    expect(JSON.stringify(output)).not.toContain("aGVsbG8=");
  });
});
