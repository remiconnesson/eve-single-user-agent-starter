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

import { AgentChatSession } from "./agent-chat";

const MODEL = "zai/glm-5.2";

const chat = {
  createdAt: "2026-06-19T12:00:00.000Z",
  events: [],
  id: "chat-1",
  session: { streamIndex: 0 },
  title: "Current chat",
  updatedAt: "2026-06-19T12:00:00.000Z",
} as const;

const historyProps = {
  chat,
  chats: [chat],
  historyAvailable: true,
  onCreateChat: vi.fn(async () => undefined),
  onPersistChat: vi.fn(async () => undefined),
  onRemoveChat: vi.fn(async () => undefined),
  onSelectChat: vi.fn(async () => undefined),
} as const;

function renderChat(stopButtonEnabled = false) {
  return renderToStaticMarkup(
    <AgentChatSession
      {...historyProps}
      model={MODEL}
      stopButtonEnabled={stopButtonEnabled}
    />,
  );
}

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
      events: [],
      send: mocks.send,
      session: { streamIndex: 0 },
      status: "ready",
      stop: mocks.stop,
    });
  });

  it("disables an unanswered option after a newer user message", () => {
    const html = renderChat();

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Approve<\/button>/);
  });

  it("keeps the latest unanswered option available", () => {
    mocks.useEveAgent.mockReturnValue({
      data: { messages: messages.slice(0, 1) },
      error: undefined,
      events: [],
      send: mocks.send,
      session: { streamIndex: 0 },
      status: "ready",
      stop: mocks.stop,
    });

    const html = renderChat();

    expect(html).toMatch(/<button(?![^>]*disabled="")[^>]*>Approve<\/button>/);
  });

  it("renders the configured model", () => {
    const html = renderChat();

    expect(html).toContain(MODEL);
  });

  it("keeps diagnostic codes and support instructions out of error UI", () => {
    mocks.useEveAgent.mockReturnValue({
      data: { messages },
      error: new Error("Request failed"),
      events: [],
      send: mocks.send,
      session: { streamIndex: 0 },
      status: "error",
      stop: mocks.stop,
    });

    const html = renderChat();

    expect(html).toContain("Request failed");
    expect(html).not.toContain('href="/diagnostics"');
    expect(html).not.toContain("EVE_R001");
    expect(html).not.toContain("support report");
  });

  it("renders the sign-out action", () => {
    const html = renderChat();

    expect(html).toMatch(
      /<form action="\/api\/auth\/logout" method="post">.*Sign Out<\/button>/,
    );
  });

  it("hides the stop action while the feature flag is disabled", () => {
    mocks.useEveAgent.mockReturnValue({
      data: { messages },
      error: undefined,
      events: [],
      send: mocks.send,
      session: { streamIndex: 0 },
      status: "streaming",
      stop: mocks.stop,
    });

    const html = renderChat();

    expect(html).not.toContain('aria-label="Stop"');
    expect(html).toMatch(/<button[^>]*aria-label="Submit"[^>]*disabled=""/);
  });

  it("offers eve's stop action while the feature flag is enabled", () => {
    mocks.useEveAgent.mockReturnValue({
      data: { messages },
      error: undefined,
      events: [],
      send: mocks.send,
      session: { streamIndex: 0 },
      status: "streaming",
      stop: mocks.stop,
    });

    const html = renderChat(true);

    expect(html).toContain('aria-label="Stop"');
  });

  it("restores the complete saved eve session", () => {
    renderChat();

    expect(mocks.useEveAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        initialEvents: chat.events,
        initialSession: chat.session,
        maxReconnectAttempts: 15,
      }),
    );
  });

  it("renders browser history and a new-chat action", () => {
    const html = renderChat();

    expect(html).toContain("Current chat");
    expect(html).toContain("New Chat");
    expect(html).toContain("Saved in this browser");
  });

  it("exposes mobile history as a dialog trigger", () => {
    const html = renderChat();

    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("offers a multi-file queue outside the prompt form", () => {
    const html = renderChat();

    expect(html).toContain('aria-label="Add files to sandbox"');
    expect(html).toContain('title="Add up to 5 files, 1 MiB each"');
    expect(html).toMatch(/data-user-upload-queue="true"[\s\S]*<form/u);
    expect(html).not.toContain('aria-label="Upload files"');
  });
});
