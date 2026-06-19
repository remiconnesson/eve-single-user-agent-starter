"use client";

import { HistoryIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ChatHistorySummary } from "@/lib/chat-history/store";
import { ChatHistoryPanel } from "./chat-history-panel";

export function MobileChatHistoryDialog({
  activeId,
  chats,
  disabled,
  historyAvailable,
  onCreateChat,
  onRemoveChat,
  onSelectChat,
}: {
  readonly activeId: string;
  readonly chats: readonly ChatHistorySummary[];
  readonly disabled: boolean;
  readonly historyAvailable: boolean;
  readonly onCreateChat: () => Promise<void>;
  readonly onRemoveChat: (id: string) => Promise<void>;
  readonly onSelectChat: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label="Open chat history"
          className="md:hidden"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HistoryIcon aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="top-0 left-0 flex h-dvh w-[min(20rem,85vw)] max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 bg-[#fafafa] p-0 shadow-lg data-[state=closed]:slide-out-to-left data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-left data-[state=open]:zoom-in-100 sm:max-w-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Chat history</DialogTitle>
        <DialogDescription className="sr-only">
          Create, select, or delete chats saved in this browser.
        </DialogDescription>
        <ChatHistoryPanel
          activeId={activeId}
          chats={chats}
          closeButton={
            <DialogClose asChild>
              <Button
                aria-label="Close chat history"
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            </DialogClose>
          }
          disabled={disabled}
          historyAvailable={historyAvailable}
          onCreateChat={() => {
            setOpen(false);
            void onCreateChat();
          }}
          onRemoveChat={(id) => void onRemoveChat(id)}
          onSelectChat={(id) => {
            setOpen(false);
            void onSelectChat(id);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
