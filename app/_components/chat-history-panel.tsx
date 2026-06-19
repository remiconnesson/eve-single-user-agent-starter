import { HistoryIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ChatHistorySummary } from "@/lib/chat-history/store";
import { cn } from "@/lib/utils";

export function ChatHistoryPanel({
  activeId,
  chats,
  closeButton,
  disabled,
  historyAvailable,
  onCreateChat,
  onRemoveChat,
  onSelectChat,
}: {
  readonly activeId: string;
  readonly chats: readonly ChatHistorySummary[];
  readonly closeButton?: ReactNode;
  readonly disabled: boolean;
  readonly historyAvailable: boolean;
  readonly onCreateChat: () => void;
  readonly onRemoveChat: (id: string) => void;
  readonly onSelectChat: (id: string) => void;
}) {
  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HistoryIcon aria-hidden="true" className="size-4" />
          History
        </div>
        {closeButton}
      </div>

      <div className="p-3">
        <Button
          className="w-full justify-start border-gray-400 bg-background shadow-none"
          disabled={disabled}
          onClick={onCreateChat}
          size="sm"
          type="button"
          variant="outline"
        >
          <PlusIcon aria-hidden="true" />
          New Chat
        </Button>
      </div>

      {historyAvailable ? null : (
        <p className="mx-3 mb-2 rounded-md border border-amber-400 bg-amber-100 px-3 py-2 text-xs leading-5 text-amber-900">
          History is unavailable. This chat may not survive a reload.
        </p>
      )}

      <nav aria-label="Chat history" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <ul className="space-y-1">
          {chats.map((item) => {
            const isActive = item.id === activeId;
            return (
              <li
                className={cn(
                  "group flex items-center rounded-md",
                  isActive ? "bg-gray-200" : "hover:bg-gray-100",
                )}
                key={item.id}
              >
                <button
                  aria-current={isActive ? "page" : undefined}
                  className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-gray-1000 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => {
                    if (!isActive) onSelectChat(item.id);
                  }}
                  title={item.title}
                  type="button"
                >
                  {item.title}
                </button>
                <button
                  aria-label={`Delete ${item.title}`}
                  className="mr-1 grid size-7 shrink-0 place-items-center rounded-md text-gray-800 opacity-0 outline-none transition-opacity hover:bg-gray-300 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                  disabled={disabled}
                  onClick={() => onRemoveChat(item.id)}
                  type="button"
                >
                  <Trash2Icon aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="shrink-0 border-t px-4 py-3 text-xs text-gray-800">
        Saved in this browser
      </p>
    </div>
  );
}

export function ChatHistoryLoading() {
  return (
    <main className="grid h-dvh place-items-center bg-[#fafafa] text-sm text-gray-900">
      <span aria-live="polite" role="status">
        Loading chat history…
      </span>
    </main>
  );
}
