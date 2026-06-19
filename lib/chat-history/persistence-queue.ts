import type { ChatHistoryRecord } from "./store";

export interface ChatPersistenceQueue {
  enqueue(chat: ChatHistoryRecord): void;
  flush(): Promise<void>;
}

export function createChatPersistenceQueue({
  onError,
  persist,
}: {
  readonly onError: (error: unknown) => void;
  readonly persist: (chat: ChatHistoryRecord) => Promise<void>;
}): ChatPersistenceQueue {
  const pending = new Map<string, ChatHistoryRecord>();
  let active: Promise<void> | null = null;

  const drain = async () => {
    while (pending.size > 0) {
      const next = pending.entries().next();
      if (next.done) return;

      const [id, chat] = next.value;
      pending.delete(id);

      try {
        await persist(chat);
      } catch (error) {
        onError(error);
      }
    }
  };

  const ensureDrain = () => {
    if (active !== null || pending.size === 0) return;

    active = drain().finally(() => {
      active = null;
      ensureDrain();
    });
  };

  return {
    enqueue(chat) {
      // Reinsert an existing key so the most recently changed chat stays last.
      pending.delete(chat.id);
      pending.set(chat.id, chat);
      ensureDrain();
    },
    async flush() {
      for (;;) {
        ensureDrain();
        const current = active;
        if (current === null) return;
        await current;
      }
    },
  };
}
