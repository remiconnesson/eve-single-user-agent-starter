"use client";

import { useEveAgent } from "eve/react";
import { log as clientLog } from "evlog/next/client";
import { AlertCircleIcon, ArrowRightIcon, LogOutIcon, TerminalIcon } from "lucide-react";
import { useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";

const BETA_TERMS_HREF = "https://vercel.com/docs/release-phases/public-beta-agreement";
const SUGGESTIONS = [
  "Inspect This Project",
  "Write a Small Script",
  "Research a Topic",
  "Run a Sandbox Command",
] as const;

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

export function AgentChat({ model }: { readonly model: string }) {
  const agent = useEveAgent();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;
  const lastUserMessageIndex = agent.data.messages.findLastIndex(
    (message) => message.role === "user",
  );
  const errorMessage = agent.error?.message;
  const errorName = agent.error?.name;

  useEffect(() => {
    if (!errorMessage) return;
    clientLog.error({ diagnosticCode: "EVE_R001", errorName, event: "agent.request_failed" });
  }, [errorMessage, errorName]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isBusy) return;

    clientLog.info({ event: "agent.message_submitted", messageLength: text.length });
    await agent.send({ message: text });
  };

  const composer = (
    <PromptInput
      className="rounded-md border-gray-400 bg-background shadow-[0_2px_2px_rgba(0,0,0,0.04)] focus-within:border-gray-600"
      onSubmit={handleSubmit}
    >
      <PromptInputTextarea
        aria-label="Message Eve"
        className="min-h-24 px-4 py-3 pr-14 text-[16px] leading-6 placeholder:text-gray-700 sm:text-sm"
        placeholder="Ask Eve anything…"
      />
      <PromptInputSubmit
        className="right-3 bottom-3 rounded-md"
        onStop={agent.stop}
        status={agent.status}
      />
    </PromptInput>
  );

  return (
    <main className="relative h-dvh overflow-hidden bg-[#fafafa] text-foreground">
      <div
        aria-hidden="true"
        className="geist-grid pointer-events-none absolute inset-0 opacity-70"
      />
      <section className="relative mx-auto flex h-full w-full max-w-[960px] flex-col bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.04)] sm:border-x">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
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
            {agent.error ? (
              <a
                className="whitespace-nowrap text-xs text-gray-900 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href="/diagnostics"
              >
                Diagnostics
              </a>
            ) : null}
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
                  {agent.error.message} Diagnostic code EVE_R001. Open Diagnostics and copy the
                  support report if retrying does not work.
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
                  What can Eve help with?
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-gray-900 sm:text-base">
                  Ask a question, inspect a project, or run tools in a secure sandbox.
                </p>
              </div>

              {composer}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    className="group flex min-h-10 items-center justify-between rounded-md border border-gray-400 bg-background px-3 text-left text-sm text-gray-900 transition-colors hover:border-gray-500 hover:bg-gray-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isBusy}
                    key={suggestion}
                    onClick={() => {
                      clientLog.info({
                        event: "agent.suggestion_submitted",
                        messageLength: suggestion.length,
                      });
                      void agent.send({ message: suggestion });
                    }}
                    type="button"
                  >
                    <span>{suggestion}</span>
                    <ArrowRightIcon
                      aria-hidden="true"
                      className="size-3.5 text-gray-700 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transform-none"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="mx-auto w-full max-w-3xl gap-8 px-4 py-8 sm:px-6 sm:py-10">
              {agent.data.messages.map((message, index, messages) => (
                <AgentMessage
                  canRespond={!isBusy && index > lastUserMessageIndex}
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
                Eve can make mistakes. Review tool output before using it.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
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
