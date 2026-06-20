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

    expect(html).toContain('<img alt="generated.png"');
    expect(html).toContain("data:image/png;base64,iVBORw==");
    expect(html).toContain("Download image");
  });

  it("renders downloaded image bytes inline with a download action", () => {
    const html = renderToolMessage("download_file", {
      byteLength: 4,
      dataBase64: "iVBORw==",
      filename: "chart.png",
      mediaType: "image/png",
      path: "/workspace/chart.png",
    });

    expect(html).toContain('<img alt="chart.png"');
    expect(html).toContain("data:image/png;base64,iVBORw==");
    expect(html).toContain('download="chart.png"');
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
    expect(html).not.toContain("<img");
  });

  it("keeps unsupported image media types download-only", () => {
    const html = renderToolMessage("download_file", {
      byteLength: 6,
      dataBase64: "PHN2Zy8+",
      filename: "chart.svg",
      mediaType: "image/svg+xml",
      path: "/workspace/chart.svg",
    });

    expect(html).toContain('download="chart.svg"');
    expect(html).not.toContain("<img");
  });

  it("does not create a download for malformed output", () => {
    const html = renderToolMessage("download_file", {
      filename: "report.txt",
      path: "/workspace/report.txt",
    });

    expect(html).not.toContain('download="report.txt"');
  });
});
