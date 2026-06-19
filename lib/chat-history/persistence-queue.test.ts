import { describe, expect, it, vi } from "vitest";
import type { ChatHistoryRecord } from "./store";
import { createChatPersistenceQueue } from "./persistence-queue";

function record({
  id = "chat-1",
  streamIndex,
}: {
  readonly id?: string;
  readonly streamIndex: number;
}) {
  return {
    createdAt: "2026-06-19T12:00:00.000Z",
    events: [],
    id,
    session: { streamIndex },
    title: "Conversation",
    updatedAt: `2026-06-19T12:00:0${streamIndex}.000Z`,
  } satisfies ChatHistoryRecord;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("chat persistence queue", () => {
  it("serializes writes and keeps only the newest pending snapshot per chat", async () => {
    const first = deferred();
    const latest = deferred();
    const persist = vi
      .fn<(chat: ChatHistoryRecord) => Promise<void>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => latest.promise);
    const queue = createChatPersistenceQueue({ onError: vi.fn(), persist });

    queue.enqueue(record({ streamIndex: 1 }));
    queue.enqueue(record({ streamIndex: 2 }));
    queue.enqueue(record({ streamIndex: 3 }));

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0]?.[0].session.streamIndex).toBe(1);

    first.resolve();
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
    expect(persist.mock.calls[1]?.[0].session.streamIndex).toBe(3);

    latest.resolve();
    await queue.flush();
  });

  it("persists pending snapshots for different chats", async () => {
    const first = deferred();
    const persist = vi
      .fn<(chat: ChatHistoryRecord) => Promise<void>>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const queue = createChatPersistenceQueue({ onError: vi.fn(), persist });

    queue.enqueue(record({ id: "chat-1", streamIndex: 1 }));
    queue.enqueue(record({ id: "chat-2", streamIndex: 1 }));
    first.resolve();
    await queue.flush();

    expect(persist.mock.calls.map(([chat]) => chat.id)).toEqual(["chat-1", "chat-2"]);
  });

  it("reports a failed write and continues processing later snapshots", async () => {
    const error = new Error("database unavailable");
    const onError = vi.fn();
    const persist = vi
      .fn<(chat: ChatHistoryRecord) => Promise<void>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);
    const queue = createChatPersistenceQueue({ onError, persist });

    queue.enqueue(record({ streamIndex: 1 }));
    await queue.flush();
    queue.enqueue(record({ streamIndex: 2 }));
    await queue.flush();

    expect(onError).toHaveBeenCalledWith(error);
    expect(persist).toHaveBeenCalledTimes(2);
  });
});
