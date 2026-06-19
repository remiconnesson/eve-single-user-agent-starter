import { renderToStaticMarkup } from "react-dom/server";
import type { EveMessage } from "eve/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  stop: vi.fn(),
  useEveAgent: vi.fn(),
}));

vi.mock("eve/react", () => ({ useEveAgent: mocks.useEveAgent }));
vi.mock("evlog/next/client", () => ({
  log: { error: vi.fn(), info: vi.fn() },
}));

import { AgentChat } from "./agent-chat";

const MODEL = "zai/glm-5.2";

const messages = [
  {
    id: "assistant-question",
    parts: [
      {
        approval: { id: "request-1" },
        input: { prompt: "Continue?" },
        state: "approval-requested",
        toolCallId: "ask-1",
        toolMetadata: {
          eve: {
            inputRequest: {
              options: [{ id: "approve", label: "Approve" }],
              prompt: "Continue?",
              requestId: "request-1",
            },
            kind: "tool-call",
            name: "ask_question",
          },
        },
        toolName: "ask_question",
        type: "dynamic-tool",
      },
    ],
    role: "assistant",
  },
  {
    id: "newer-user-message",
    parts: [{ text: "Do something else", type: "text" }],
    role: "user",
  },
] satisfies readonly EveMessage[];

describe("AgentChat input requests", () => {
  beforeEach(() => {
    mocks.useEveAgent.mockReturnValue({
      data: { messages },
      error: undefined,
      send: mocks.send,
      status: "ready",
      stop: mocks.stop,
    });
  });

  it("disables an unanswered option after a newer user message", () => {
    const html = renderToStaticMarkup(<AgentChat model={MODEL} />);

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Approve<\/button>/);
  });

  it("keeps the latest unanswered option available", () => {
    mocks.useEveAgent.mockReturnValue({
      data: { messages: messages.slice(0, 1) },
      error: undefined,
      send: mocks.send,
      status: "ready",
      stop: mocks.stop,
    });

    const html = renderToStaticMarkup(<AgentChat model={MODEL} />);

    expect(html).toMatch(/<button(?![^>]*disabled="")[^>]*>Approve<\/button>/);
  });

  it("renders the configured model", () => {
    const html = renderToStaticMarkup(<AgentChat model={MODEL} />);

    expect(html).toContain(MODEL);
    expect(html).not.toContain("claude-sonnet-4.6");
  });

  it("hides diagnostics when the agent has no error", () => {
    const html = renderToStaticMarkup(<AgentChat model={MODEL} />);

    expect(html).not.toContain('href="/diagnostics"');
  });

  it("shows diagnostics when the agent has an error", () => {
    mocks.useEveAgent.mockReturnValue({
      data: { messages },
      error: new Error("Request failed"),
      send: mocks.send,
      status: "error",
      stop: mocks.stop,
    });

    const html = renderToStaticMarkup(<AgentChat model={MODEL} />);

    expect(html).toContain('href="/diagnostics"');
  });
});
