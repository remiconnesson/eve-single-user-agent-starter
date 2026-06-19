import type { HandleMessageStreamEvent } from "eve/client";
import { z } from "zod";
import {
  type ChatHistoryRecord,
  type ChatHistoryStore,
  toChatHistorySummary,
} from "./store";

const DEFAULT_STORAGE_KEY = "eve.chat-history.v1";
const STORAGE_VERSION = 1;

const eventTypes = [
  "action.result",
  "actions.requested",
  "authorization.completed",
  "authorization.required",
  "compaction.completed",
  "compaction.requested",
  "input.requested",
  "message.appended",
  "message.completed",
  "message.received",
  "reasoning.appended",
  "reasoning.completed",
  "result.completed",
  "session.completed",
  "session.failed",
  "session.started",
  "session.waiting",
  "step.completed",
  "step.failed",
  "step.started",
  "subagent.called",
  "subagent.event",
  "subagent.completed",
  "subagent.started",
  "turn.completed",
  "turn.failed",
  "turn.started",
] as const satisfies readonly HandleMessageStreamEvent["type"][];
type MissingEventType = Exclude<HandleMessageStreamEvent["type"], (typeof eventTypes)[number]>;
const allEventTypesCovered: MissingEventType extends never ? true : never = true;

const sessionSchema = z.object({
  continuationToken: z.string().optional(),
  sessionId: z.string().optional(),
  streamIndex: z.number().int().nonnegative(),
});

const storedRecordSchema = z.object({
  createdAt: z.string().datetime(),
  events: z.array(z.unknown()),
  id: z.string().min(1).max(100),
  session: sessionSchema,
  title: z.string().min(1).max(120),
  updatedAt: z.string().datetime(),
});

const storageEnvelopeSchema = z.object({
  chats: z.array(storedRecordSchema),
  version: z.literal(STORAGE_VERSION),
});

export function createLocalStorageChatHistoryStore({
  key = DEFAULT_STORAGE_KEY,
  storage,
}: {
  readonly key?: string;
  readonly storage?: Storage;
} = {}): ChatHistoryStore {
  const resolveStorage = () => {
    if (storage) return storage;
    if (typeof window === "undefined") {
      throw new Error("Chat history storage is only available in the browser.");
    }
    return window.localStorage;
  };

  const read = (): ChatHistoryRecord[] => {
    const resolvedStorage = resolveStorage();
    const raw = resolvedStorage.getItem(key);
    if (!raw) return [];

    try {
      const parsed = storageEnvelopeSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new Error("Invalid chat history envelope.");

      const chats: ChatHistoryRecord[] = [];
      for (const chat of parsed.data.chats) {
        const events = parseEvents(chat.events);
        if (!events) throw new Error("Invalid chat history event.");
        chats.push({ ...chat, events });
      }
      return chats;
    } catch {
      resolvedStorage.removeItem(key);
      return [];
    }
  };

  const write = (chats: readonly ChatHistoryRecord[]) => {
    resolveStorage().setItem(
      key,
      JSON.stringify({ chats, version: STORAGE_VERSION }),
    );
  };

  return {
    async get(id) {
      return read().find((chat) => chat.id === id) ?? null;
    },
    async list() {
      return read()
        .map(toChatHistorySummary)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async remove(id) {
      write(read().filter((chat) => chat.id !== id));
    },
    async upsert(chat) {
      const chats = read();
      const existing = chats.find((candidate) => candidate.id === chat.id);
      const compactChat = { ...chat, events: compactEvents(chat.events) };
      const nextChat = existing
        ? { ...compactChat, createdAt: existing.createdAt }
        : compactChat;
      write([...chats.filter((candidate) => candidate.id !== chat.id), nextChat]);
    },
  };
}

function parseEvents(values: readonly unknown[]): HandleMessageStreamEvent[] | null {
  const events: HandleMessageStreamEvent[] = [];
  for (const value of values) {
    if (!isStreamEvent(value)) return null;
    events.push(value);
  }
  return events;
}

function compactEvents(
  events: readonly HandleMessageStreamEvent[],
): readonly HandleMessageStreamEvent[] {
  return events
    .filter(
      (event) => event.type !== "message.appended" && event.type !== "reasoning.appended",
    )
    .map(compactEvent);
}

function compactEvent(event: HandleMessageStreamEvent): HandleMessageStreamEvent {
  if (event.type !== "action.result" || event.data.result.kind !== "tool-result") {
    return event;
  }

  const output = event.data.result.output;
  if (!isRecord(output) || typeof output.dataBase64 !== "string") {
    return event;
  }

  const { dataBase64: _dataBase64, ...compactOutput } = output;
  return {
    ...event,
    data: {
      ...event.data,
      result: {
        ...event.data.result,
        output: { ...compactOutput, dataBase64Omitted: true },
      },
    },
  };
}

function isStreamEvent(value: unknown): value is HandleMessageStreamEvent {
  if (!isRecord(value) || !isEventType(value.type)) return false;
  if (value.meta !== undefined) {
    if (!isRecord(value.meta) || typeof value.meta.at !== "string") return false;
  }
  if (value.type === "session.completed") return value.data === undefined;
  return isRecord(value.data);
}

function isEventType(value: unknown): value is HandleMessageStreamEvent["type"] {
  return (
    allEventTypesCovered &&
    typeof value === "string" &&
    eventTypes.some((eventType) => eventType === value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
