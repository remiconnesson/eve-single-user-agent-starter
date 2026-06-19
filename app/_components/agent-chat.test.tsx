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
    const html = renderToStaticMarkup(<AgentChat />);

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

    const html = renderToStaticMarkup(<AgentChat />);

    expect(html).toMatch(/<button(?![^>]*disabled="")[^>]*>Approve<\/button>/);
  });
});
