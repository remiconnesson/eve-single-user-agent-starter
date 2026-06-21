import type { HandleMessageStreamEvent, SessionState } from "eve/client";
import { beforeEach, describe, expect, it } from "vitest";
import type { ChatHistoryRecord } from "./store";
import { createLocalStorageChatHistoryStore } from "./local-storage";

const STORAGE_KEY = "chat-history-test";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

const session = {
  continuationToken: "eve:continuation",
  sessionId: "session-1",
  streamIndex: 1,
} satisfies SessionState;

const events = [{ data: {}, type: "session.started" }] satisfies readonly HandleMessageStreamEvent[];

function record(overrides: Partial<ChatHistoryRecord> = {}): ChatHistoryRecord {
  return {
    createdAt: "2026-06-19T12:00:00.000Z",
    events,
    id: "chat-1",
    session,
    title: "First conversation",
    updatedAt: "2026-06-19T12:00:00.000Z",
    ...overrides,
  };
}

describe("LocalStorageChatHistoryStore", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("persists complete eve session state behind the history-store interface", async () => {
    const store = createLocalStorageChatHistoryStore({ key: STORAGE_KEY, storage });
    const chat = record();

    await store.upsert(chat);

    await expect(store.get(chat.id)).resolves.toEqual(chat);
    await expect(store.list()).resolves.toEqual([
      {
        createdAt: chat.createdAt,
        id: chat.id,
        title: chat.title,
        updatedAt: chat.updatedAt,
      },
    ]);
  });

  it("updates existing chats and sorts the newest chat first", async () => {
    const store = createLocalStorageChatHistoryStore({ key: STORAGE_KEY, storage });
    await store.upsert(record());
    await store.upsert(
      record({
        createdAt: "2026-06-19T12:01:00.000Z",
        id: "chat-2",
        title: "Second conversation",
        updatedAt: "2026-06-19T12:01:00.000Z",
      }),
    );
    await store.upsert(
      record({ title: "Renamed conversation", updatedAt: "2026-06-19T12:02:00.000Z" }),
    );

    await expect(store.list()).resolves.toMatchObject([
      { id: "chat-1", title: "Renamed conversation" },
      { id: "chat-2", title: "Second conversation" },
    ]);
  });

  it("deletes a chat without changing the others", async () => {
    const store = createLocalStorageChatHistoryStore({ key: STORAGE_KEY, storage });
    await store.upsert(record());
    await store.upsert(record({ id: "chat-2", title: "Second conversation" }));

    await store.remove("chat-1");

    await expect(store.get("chat-1")).resolves.toBeNull();
    await expect(store.list()).resolves.toMatchObject([{ id: "chat-2" }]);
  });

  it("drops cumulative streaming deltas while keeping completed messages", async () => {
    const store = createLocalStorageChatHistoryStore({ key: STORAGE_KEY, storage });
    const streamedEvents = [
      ...events,
      {
        data: {
          messageDelta: "Hello",
          messageSoFar: "Hello",
          sequence: 0,
          stepIndex: 0,
          turnId: "turn-1",
        },
        type: "message.appended",
      },
      {
        data: {
          finishReason: "stop",
          message: "Hello",
          sequence: 0,
          stepIndex: 0,
          turnId: "turn-1",
        },
        type: "message.completed",
      },
    ] satisfies readonly HandleMessageStreamEvent[];

    await store.upsert(record({ events: streamedEvents }));

    await expect(store.get("chat-1")).resolves.toMatchObject({
      events: [events[0], streamedEvents[2]],
    });
  });

  it("does not persist inline sandbox file bytes", async () => {
    const store = createLocalStorageChatHistoryStore({ key: STORAGE_KEY, storage });
    const fileResult = {
      data: {
        result: {
          callId: "call-1",
          kind: "tool-result",
          output: {
            dataBase64: "a".repeat(1_000_000),
            filename: "generated.png",
            path: "/workspace/generated/generated.png",
          },
          toolName: "generate_image",
        },
        sequence: 0,
        status: "completed",
        stepIndex: 0,
        turnId: "turn-1",
      },
      type: "action.result",
    } satisfies HandleMessageStreamEvent;

    await store.upsert(record({ events: [...events, fileResult] }));

    expect(storage.getItem(STORAGE_KEY)).not.toContain("a".repeat(100));
    await expect(store.get("chat-1")).resolves.toMatchObject({
      events: [
        events[0],
        {
          data: {
            result: {
              output: {
                dataBase64Omitted: true,
                filename: "generated.png",
                path: "/workspace/generated/generated.png",
              },
            },
          },
        },
      ],
    });
  });

  it("ignores corrupted browser data instead of breaking the chat", async () => {
    storage.setItem(STORAGE_KEY, "not json");
    const store = createLocalStorageChatHistoryStore({ key: STORAGE_KEY, storage });

    await expect(store.list()).resolves.toEqual([]);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});
