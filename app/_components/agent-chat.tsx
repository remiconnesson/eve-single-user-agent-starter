"use client";

import type { UserContent } from "ai";
import { useEveAgent } from "eve/react";
import { log as clientLog } from "evlog/next/client";
import {
  AlertCircleIcon,
  LogOutIcon,
  TerminalIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { PromptInputStop } from "@/components/ai-elements/prompt-input-stop";
import { Button } from "@/components/ui/button";
import type {
  ChatHistoryRecord,
  ChatHistorySummary,
} from "@/lib/chat-history/store";
import { UNTITLED_CHAT_TITLE } from "@/lib/chat-history/store";
import {
  diagnostics,
  toDiagnosticLogFields,
} from "@/lib/diagnostics/catalog";
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";
import { ChatHistoryPanel } from "./chat-history-panel";
import { MobileChatHistoryDialog } from "./mobile-chat-history-dialog";
import { createSandboxFileMessage } from "./sandbox-file";
import { SandboxUploadControl } from "./sandbox-upload-control";

const BETA_TERMS_HREF = "https://vercel.com/docs/release-phases/public-beta-agreement";
const AGENT_REQUEST_DIAGNOSTIC = toDiagnosticLogFields(diagnostics.EVE_R001());
const FILE_UPLOAD_DIAGNOSTIC = toDiagnosticLogFields(diagnostics.EVE_R002());
// Vercel rotated the observed stream about every two minutes. Keep long turns
// attached for roughly 30 minutes while vercel/eve#134 is unresolved.
const MAX_STREAM_RECONNECT_ATTEMPTS = 15;

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

export function AgentChatSession({
  chat,
  chats,
  historyAvailable,
  model,
  onCreateChat,
  onPersistChat,
  onRemoveChat,
  onSelectChat,
  stopButtonEnabled,
}: {
  readonly chat: ChatHistoryRecord;
  readonly chats: readonly ChatHistorySummary[];
  readonly historyAvailable: boolean;
  readonly model: string;
  readonly onCreateChat: () => Promise<void>;
  readonly onPersistChat: (chat: ChatHistoryRecord) => Promise<void>;
  readonly onRemoveChat: (id: string) => Promise<void>;
  readonly onSelectChat: (id: string) => Promise<void>;
  readonly stopButtonEnabled: boolean;
}) {
  const titleRef = useRef(chat.title);
  const persistedCursorRef = useRef(`${chat.events.length}:${chat.session.streamIndex}`);
  const [draft, setDraft] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<readonly File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const turnErrorRef = useRef<Error | null>(null);
  const agent = useEveAgent({
    initialEvents: chat.events,
    initialSession: chat.session,
    maxReconnectAttempts: MAX_STREAM_RECONNECT_ATTEMPTS,
    onError: (error) => {
      turnErrorRef.current = error;
    },
  });
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const stopStatus = isBusy ? agent.status : null;
  const isSubmitting = isBusy || isUploading;
  const isEmpty = agent.data.messages.length === 0;
  const lastUserMessageIndex = agent.data.messages.findLastIndex(
    (message) => message.role === "user",
  );
  const errorMessage = agent.error?.message;
  const errorName = agent.error?.name;

  useEffect(() => {
    if (!errorMessage) return;
    clientLog.error({
      diagnostic: AGENT_REQUEST_DIAGNOSTIC,
      diagnosticCode: AGENT_REQUEST_DIAGNOSTIC.code,
      errorName,
      event: "agent.request_failed",
    });
  }, [errorMessage, errorName]);

  useEffect(() => {
    if (agent.events.length === 0) return;
    const cursor = `${agent.events.length}:${agent.session.streamIndex}`;
    if (persistedCursorRef.current === cursor) return;

    const persistSnapshot = () => {
      if (persistedCursorRef.current === cursor) return;
      persistedCursorRef.current = cursor;
      void onPersistChat({
        createdAt: chat.createdAt,
        events: agent.events,
        id: chat.id,
        session: agent.session,
        title: titleRef.current,
        updatedAt: new Date().toISOString(),
      });
    };

    if (agent.status !== "submitted" && agent.status !== "streaming") {
      persistSnapshot();
      return;
    }

    const timeout = window.setTimeout(persistSnapshot, 300);
    return () => window.clearTimeout(timeout);
  }, [
    agent.events,
    agent.session,
    agent.status,
    chat.createdAt,
    chat.id,
    onPersistChat,
  ]);

  const sendMessage = async (text: string) => {
    const normalizedText = text.trim();
    if (!normalizedText || isSubmitting) return;

    const sendAgentMessage = async (message: UserContent) => {
      turnErrorRef.current = null;
      await agent.send({ message });
      if (turnErrorRef.current) {
        throw turnErrorRef.current;
      }
    };

    if (chat.title === UNTITLED_CHAT_TITLE) {
      titleRef.current = createChatTitle(normalizedText);
    }

    if (pendingFiles.length === 0) {
      await sendAgentMessage(normalizedText);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    let content: UserContent;
    try {
      content = await createSandboxFileMessage({
        files: pendingFiles,
        text: normalizedText,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The files could not be uploaded.";
      setUploadError(message);
      clientLog.error({
        diagnostic: FILE_UPLOAD_DIAGNOSTIC,
        diagnosticCode: FILE_UPLOAD_DIAGNOSTIC.code,
        event: "agent.file_submit_failed",
      });
      throw error;
    } finally {
      setIsUploading(false);
    }

    await sendAgentMessage(content);
    setPendingFiles([]);
    clientLog.info({
      event: "agent.files_submitted",
      fileCount: pendingFiles.length,
      messageLength: normalizedText.length,
    });
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isSubmitting) return;

    setDraft("");
    clientLog.info({ event: "agent.message_submitted", messageLength: text.length });
    try {
      await sendMessage(text);
    } catch (error) {
      setDraft((current) => (current === "" ? message.text : current));
      throw error;
    }
  };

  const composer = (
    <div>
      <SandboxUploadControl
        disabled={isSubmitting}
        files={pendingFiles}
        onFilesChange={setPendingFiles}
        onUploadError={setUploadError}
      />
      <PromptInput
        className="rounded-md border-gray-400 bg-background shadow-[0_2px_2px_rgba(0,0,0,0.04)] focus-within:border-gray-600"
        onSubmit={handleSubmit}
      >
        <PromptInputTextarea
          aria-label="Message eve"
          className="min-h-24 px-4 py-3 pr-14 text-[16px] leading-6 placeholder:text-gray-700 sm:text-sm"
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder="Ask eve anything…"
          value={draft}
        />
        {stopButtonEnabled && stopStatus ? (
          <PromptInputStop
            className="right-3 bottom-3 rounded-md"
            onStop={agent.stop}
            status={stopStatus}
          />
        ) : (
          <PromptInputSubmit
            className="right-3 bottom-3 rounded-md"
            disabled={isSubmitting}
            status={isUploading ? "submitted" : agent.status}
          />
        )}
      </PromptInput>
      {uploadError ? (
        <p className="mt-2 text-xs text-red-900" role="alert">
          {uploadError}
        </p>
      ) : null}
    </div>
  );

  return (
    <main className="relative h-dvh overflow-hidden bg-[#fafafa] text-foreground">
      <div
        aria-hidden="true"
        className="geist-grid pointer-events-none absolute inset-0 opacity-70"
      />
      <div className="relative mx-auto flex h-full w-full max-w-[1200px] bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.04)] sm:border-x">
        <aside className="hidden w-60 shrink-0 border-r bg-[#fafafa] md:flex">
          <ChatHistoryPanel
            activeId={chat.id}
            chats={chats}
            disabled={isSubmitting}
            historyAvailable={historyAvailable}
            onCreateChat={() => void onCreateChat()}
            onRemoveChat={(id) => void onRemoveChat(id)}
            onSelectChat={(id) => void onSelectChat(id)}
          />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="flex h-16 shrink-0 items-center justify-between border-b px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MobileChatHistoryDialog
              activeId={chat.id}
              chats={chats}
              disabled={isSubmitting}
              historyAvailable={historyAvailable}
              onCreateChat={onCreateChat}
              onRemoveChat={onRemoveChat}
              onSelectChat={onSelectChat}
            />
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-background">
              <TerminalIcon aria-hidden="true" className="size-4" />
            </div>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="truncate font-semibold tracking-[-0.01em]">eve</span>
              <span aria-hidden="true" className="text-gray-600">
                /
              </span>
              <span className="hidden truncate text-gray-900 sm:inline">single user</span>
            </div>
            <a
              className="hidden rounded-full border border-gray-400 bg-background px-2 py-0.5 text-[11px] text-gray-900 transition-colors hover:border-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-flex"
              href={BETA_TERMS_HREF}
              rel="noreferrer"
              target="_blank"
            >
              Public Preview
            </a>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden font-mono text-xs text-gray-800 md:inline">
              {model}
            </span>
            <StatusIndicator status={agent.status} />
            <form action="/api/auth/logout" method="post">
              <Button
                className="border-gray-400 px-2.5 text-xs text-gray-900 shadow-none hover:bg-gray-100 hover:text-foreground"
                size="sm"
                type="submit"
                variant="outline"
              >
                <LogOutIcon aria-hidden="true" className="size-3.5" />
                Sign Out
              </Button>
            </form>
          </div>
          </header>

        {agent.error ? (
          <div className="shrink-0 border-b border-red-400 bg-red-100 px-4 py-3 sm:px-6">
            <div className="mx-auto flex w-full max-w-3xl items-start gap-3 text-sm">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-red-900" />
              <div>
                <p className="font-medium text-red-1000">Request Failed</p>
                <p className="mt-0.5 text-red-900">
                  {agent.error.message} Retry the request once.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-10 sm:px-6">
            <div className="w-full max-w-2xl">
              <div className="mb-8">
                <div className="mb-5 grid size-10 place-items-center rounded-md border border-gray-400 bg-background shadow-[0_2px_2px_rgba(0,0,0,0.04)]">
                  <TerminalIcon aria-hidden="true" className="size-4" />
                </div>
                <h1 className="max-w-xl text-[32px] font-semibold leading-10 tracking-[-0.04em] sm:text-[40px] sm:leading-12">
                  What can eve help with?
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-gray-900 sm:text-base">
                  Ask a question, inspect a project, or run tools in a secure sandbox.
                </p>
              </div>

              {composer}
            </div>
          </div>
        ) : (
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="mx-auto w-full max-w-3xl gap-8 px-4 py-8 sm:px-6 sm:py-10">
              {agent.data.messages.map((message, index, messages) => (
                <AgentMessage
                  canRespond={!isSubmitting && index > lastUserMessageIndex}
                  isStreaming={agent.status === "streaming" && index === messages.length - 1}
                  key={message.id}
                  message={message}
                  onInputResponses={(inputResponses) => agent.send({ inputResponses })}
                />
              ))}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}

        {isEmpty ? null : (
          <div className="shrink-0 border-t bg-background px-4 py-4 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              {composer}
              <p className="mt-2 text-center text-xs text-gray-800">
                eve can make mistakes. Review tool output before using it.
              </p>
            </div>
          </div>
        )}
        </section>
      </div>
    </main>
  );
}

function createChatTitle(message: string): string {
  const normalized = message.replace(/\s+/gu, " ").trim();
  return normalized.length > 48 ? `${normalized.slice(0, 47)}…` : normalized;
}

function StatusIndicator({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  const label =
    status === "error"
      ? "Error"
      : isLive
        ? "Working…"
        : status === "ready"
          ? "Ready"
          : "Idle";
  const tone =
    status === "error" ? "bg-red-700" : isLive ? "bg-amber-700" : "bg-green-700";

  return (
    <span
      aria-label={label}
      aria-live="polite"
      className="flex items-center gap-2 text-xs text-gray-900"
      role="status"
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone)} />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
