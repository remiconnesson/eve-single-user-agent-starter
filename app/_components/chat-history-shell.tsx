"use client";

import { log as clientLog } from "evlog/next/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createLocalStorageChatHistoryStore } from "@/lib/chat-history/local-storage";
import { createChatPersistenceQueue } from "@/lib/chat-history/persistence-queue";
import {
  type ChatHistoryRecord,
  type ChatHistoryStore,
  type ChatHistorySummary,
  toChatHistorySummary,
  UNTITLED_CHAT_TITLE,
} from "@/lib/chat-history/store";
import { AgentChatSession } from "./agent-chat";
import { ChatHistoryLoading } from "./chat-history-panel";

const localHistoryStore = createLocalStorageChatHistoryStore();

type LoadedHistory = {
  readonly activeChat: ChatHistoryRecord;
  readonly chats: readonly ChatHistorySummary[];
  readonly persistence: "available" | "unavailable";
};

type HistoryState =
  | { readonly kind: "loading" }
  | ({ readonly kind: "ready" } & LoadedHistory);

export function AgentChat({
  historyStore = localHistoryStore,
  model,
  stopButtonEnabled,
}: {
  readonly historyStore?: ChatHistoryStore;
  readonly model: string;
  readonly stopButtonEnabled: boolean;
}) {
  const [history, setHistory] = useState<HistoryState>({ kind: "loading" });

  const markPersistenceUnavailable = useCallback((error: unknown) => {
    clientLog.error({
      errorName: error instanceof Error ? error.name : "UnknownError",
      event: "history.persistence_failed",
    });
    setHistory((current) =>
      current.kind === "ready"
        ? { ...current, persistence: "unavailable" }
        : current,
    );
  }, []);

  const persistenceQueue = useMemo(
    () =>
      createChatPersistenceQueue({
        onError: markPersistenceUnavailable,
        persist: (chat) => historyStore.upsert(chat),
      }),
    [historyStore, markPersistenceUnavailable],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const chats = await historyStore.list();
        const savedChat = chats[0] ? await historyStore.get(chats[0].id) : null;
        const activeChat = savedChat ?? createEmptyChat();
        if (!savedChat) await historyStore.upsert(activeChat);
        if (!cancelled) {
          setHistory({
            activeChat,
            chats: savedChat ? chats : [toChatHistorySummary(activeChat)],
            kind: "ready",
            persistence: "available",
          });
        }
      } catch (error) {
        clientLog.error({
          errorName: error instanceof Error ? error.name : "UnknownError",
          event: "history.load_failed",
        });
        if (!cancelled) {
          const activeChat = createEmptyChat();
          setHistory({
            activeChat,
            chats: [toChatHistorySummary(activeChat)],
            kind: "ready",
            persistence: "unavailable",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [historyStore]);

  const persistChat = useCallback(
    async (chat: ChatHistoryRecord) => {
      setHistory((current) =>
        current.kind === "ready"
          ? {
              ...current,
              activeChat: chat,
              chats: upsertHistorySummary(
                current.chats,
                toChatHistorySummary(chat),
              ),
            }
          : current,
      );
      persistenceQueue.enqueue(chat);
      await persistenceQueue.flush();
    },
    [persistenceQueue],
  );

  const selectChat = useCallback(
    async (id: string) => {
      try {
        const activeChat = await historyStore.get(id);
        if (!activeChat) return;
        setHistory((current) =>
          current.kind === "ready" ? { ...current, activeChat } : current,
        );
      } catch (error) {
        markPersistenceUnavailable(error);
      }
    },
    [historyStore, markPersistenceUnavailable],
  );

  const createChat = useCallback(async () => {
    if (history.kind !== "ready") return;
    if (history.activeChat.events.length === 0) return;
    await persistChat(createEmptyChat());
  }, [history, persistChat]);

  const removeChat = useCallback(
    async (id: string) => {
      if (history.kind !== "ready") return;
      if (!window.confirm("Delete this chat from this browser?")) return;

      try {
        await persistenceQueue.flush();
        await historyStore.remove(id);
        const remaining = history.chats.filter((chat) => chat.id !== id);
        if (history.activeChat.id !== id) {
          setHistory({ ...history, chats: remaining });
          return;
        }

        const nextChat = remaining[0] ? await historyStore.get(remaining[0].id) : null;
        const activeChat = nextChat ?? createEmptyChat();
        if (!nextChat) await historyStore.upsert(activeChat);
        setHistory({
          ...history,
          activeChat,
          chats: nextChat ? remaining : [toChatHistorySummary(activeChat)],
        });
      } catch (error) {
        markPersistenceUnavailable(error);
      }
    },
    [history, historyStore, markPersistenceUnavailable, persistenceQueue],
  );

  if (history.kind === "loading") return <ChatHistoryLoading />;

  return (
    <AgentChatSession
      chat={history.activeChat}
      chats={history.chats}
      historyAvailable={history.persistence === "available"}
      key={history.activeChat.id}
      model={model}
      onCreateChat={createChat}
      onPersistChat={persistChat}
      onRemoveChat={removeChat}
      onSelectChat={selectChat}
      stopButtonEnabled={stopButtonEnabled}
    />
  );
}

function createEmptyChat(): ChatHistoryRecord {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    events: [],
    id: globalThis.crypto.randomUUID(),
    session: { streamIndex: 0 },
    title: UNTITLED_CHAT_TITLE,
    updatedAt: now,
  };
}

function upsertHistorySummary(
  chats: readonly ChatHistorySummary[],
  nextChat: ChatHistorySummary,
): readonly ChatHistorySummary[] {
  return [...chats.filter((chat) => chat.id !== nextChat.id), nextChat].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}
