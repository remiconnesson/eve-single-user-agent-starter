import { renderToStaticMarkup } from "react-dom/server";
import type { EveMessage } from "eve/react";
import { describe, expect, it, vi } from "vitest";
import { AgentMessage } from "./agent-message";

vi.mock("@/components/ai-elements/code-block", () => ({
  CodeBlock: ({ code }: { readonly code: string }) => <pre>{code}</pre>,
}));

function renderToolMessage(toolName: string, output: unknown): string {
  const message = {
    id: `${toolName}-message`,
    parts: [
      {
        input: {},
        output,
        state: "output-available",
        toolCallId: `${toolName}-call`,
        toolName,
        type: "dynamic-tool",
      },
    ],
    role: "assistant",
  } satisfies EveMessage;

  return renderToStaticMarkup(
    <AgentMessage
      canRespond={false}
      isStreaming={false}
      message={message}
      onInputResponses={() => undefined}
    />,
  );
}

describe("AgentMessage sandbox files", () => {
  it("renders generated image bytes inline with a download action", () => {
    const html = renderToolMessage("generate_image", {
      byteLength: 4,
      dataBase64: "iVBORw==",
      mediaType: "image/png",
      path: "/workspace/generated.png",
    });

    expect(html).toContain('<img alt="Generated image"');
    expect(html).toContain("data:image/png;base64,iVBORw==");
    expect(html).toContain("Download image");
  });

  it("renders a validated download_file result as a download", () => {
    const html = renderToolMessage("download_file", {
      byteLength: 5,
      dataBase64: "aGVsbG8=",
      filename: "report.txt",
      mediaType: "text/plain",
      path: "/workspace/report.txt",
    });

    expect(html).toContain('download="report.txt"');
    expect(html).toContain("Download report.txt");
  });

  it("does not create a download for malformed output", () => {
    const html = renderToolMessage("download_file", {
      filename: "report.txt",
      path: "/workspace/report.txt",
    });

    expect(html).not.toContain('download="report.txt"');
  });
});
