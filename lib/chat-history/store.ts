import type { HandleMessageStreamEvent, SessionState } from "eve/client";

export const UNTITLED_CHAT_TITLE = "New Chat";

export interface ChatHistorySummary {
  readonly createdAt: string;
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface ChatHistoryRecord extends ChatHistorySummary {
  readonly events: readonly HandleMessageStreamEvent[];
  readonly session: SessionState;
}

export function toChatHistorySummary(
  chat: ChatHistoryRecord,
): ChatHistorySummary {
  return {
    createdAt: chat.createdAt,
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt,
  };
}

/**
 * Persistence boundary for chat history. Browser storage and a future Neon
 * implementation share this contract, so the chat UI does not depend on either.
 */
export interface ChatHistoryStore {
  get(id: string): Promise<ChatHistoryRecord | null>;
  list(): Promise<readonly ChatHistorySummary[]>;
  remove(id: string): Promise<void>;
  upsert(chat: ChatHistoryRecord): Promise<void>;
}
