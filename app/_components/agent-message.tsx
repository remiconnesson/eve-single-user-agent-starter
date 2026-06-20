"use client";

import type { EveDynamicToolPart, EveMessage, EveMessagePart } from "eve/react";
import { DownloadIcon, FileIcon } from "lucide-react";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import {
  Sandbox,
  SandboxContent,
  SandboxHeader,
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
} from "@/components/ai-elements/sandbox";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import {
  type SandboxFileArtifact,
  isSandboxImageArtifact,
  parseDownloadFileOutput,
  parseGeneratedImageOutput,
  sandboxFileDataUrl,
} from "./sandbox-file";

type AgentInputResponse = {
  readonly optionId?: string;
  readonly requestId: string;
  readonly text?: string;
};

export function AgentMessage({
  canRespond,
  isStreaming,
  message,
  onInputResponses,
}: {
  readonly canRespond: boolean;
  readonly isStreaming: boolean;
  readonly message: EveMessage;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
}) {
  const lastTextIndex = message.parts.reduce(
    (last, part, index) => (part.type === "text" ? index : last),
    -1,
  );

  return (
    <Message
      className="max-w-full"
      data-optimistic={message.metadata?.optimistic ? "true" : undefined}
      from={message.role}
    >
      <MessageContent className="group-[.is-user]:rounded-md group-[.is-user]:px-3.5 group-[.is-user]:py-2.5">
        {message.parts.map((part, index) => (
          <AgentMessagePart
            canRespond={canRespond}
            key={partKey(part, index)}
            onInputResponses={onInputResponses}
            part={part}
            showCaret={isStreaming && message.role === "assistant" && index === lastTextIndex}
          />
        ))}
      </MessageContent>
    </Message>
  );
}

function AgentMessagePart({
  canRespond,
  onInputResponses,
  part,
  showCaret,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveMessagePart;
  readonly showCaret: boolean;
}) {
  switch (part.type) {
    case "step-start":
      return null;
    case "text":
      return (
        <MessageResponse caret="block" isAnimating={showCaret}>
          {part.text}
        </MessageResponse>
      );
    case "reasoning":
      return (
        <Reasoning defaultOpen isStreaming={part.state === "streaming"}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    case "dynamic-tool":
      if (part.toolName === "bash") {
        return (
          <SandboxTool
            canRespond={canRespond}
            onInputResponses={onInputResponses}
            part={part}
          />
        );
      }

      {
        const artifact = artifactFromToolPart(part);

        return (
          <>
            <Tool
              defaultOpen={
                part.state === "approval-requested" || part.state === "approval-responded"
              }
            >
              <ToolHeader
                state={part.state}
                title={part.toolName}
                toolName={part.toolName}
                type="dynamic-tool"
              />
              <ToolContent>
                <ToolInput input={part.input} />
                <InputRequestActions
                  canRespond={canRespond}
                  part={part}
                  onInputResponses={onInputResponses}
                />
                <ToolOutput
                  errorText={part.errorText}
                  output={artifact ? undefined : part.output}
                />
              </ToolContent>
            </Tool>
            {artifact ? (
              isSandboxImageArtifact(artifact) ? (
                <ImageArtifact artifact={artifact} />
              ) : (
                <DownloadFile artifact={artifact} />
              )
            ) : null}
          </>
        );
      }
  }
}

function artifactFromToolPart(part: EveDynamicToolPart): SandboxFileArtifact | null {
  if (part.state !== "output-available") return null;
  if (part.toolName === "generate_image") return parseGeneratedImageOutput(part.output);
  if (part.toolName === "download_file") return parseDownloadFileOutput(part.output);
  return null;
}

function ImageArtifact({ artifact }: { readonly artifact: SandboxFileArtifact }) {
  const dataUrl = sandboxFileDataUrl(artifact);

  return (
    <figure className="not-prose overflow-hidden rounded-md border bg-gray-100">
      {/* This authenticated, in-memory tool result is not an addressable Next.js image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={artifact.filename}
        className="max-h-[32rem] w-full object-contain"
        loading="lazy"
        src={dataUrl}
      />
      <figcaption className="flex items-center justify-between gap-3 border-t bg-background p-3">
        <span className="min-w-0 truncate font-mono text-xs text-gray-900">
          {artifact.path}
        </span>
        <Button asChild size="sm" variant="outline">
          <a download={artifact.filename} href={dataUrl}>
            <DownloadIcon aria-hidden="true" />
            Download image
          </a>
        </Button>
      </figcaption>
    </figure>
  );
}

function DownloadFile({ artifact }: { readonly artifact: SandboxFileArtifact }) {
  return (
    <div className="not-prose flex items-center justify-between gap-3 rounded-md border bg-background p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-gray-100">
          <FileIcon aria-hidden="true" className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{artifact.filename}</p>
          <p className="font-mono text-xs text-gray-800">{formatByteLength(artifact.byteLength)}</p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline">
        <a download={artifact.filename} href={sandboxFileDataUrl(artifact)}>
          <DownloadIcon aria-hidden="true" />
          Download {artifact.filename}
        </a>
      </Button>
    </div>
  );
}

function formatByteLength(byteLength: number): string {
  if (byteLength < 1024) return `${byteLength} B`;
  return `${(byteLength / 1024).toFixed(1)} KiB`;
}

function SandboxTool({
  canRespond,
  onInputResponses,
  part,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveDynamicToolPart;
}) {
  const isComplete = part.state === "output-available" || part.state === "output-error";

  return (
    <Sandbox>
      <SandboxHeader state={part.state} title="Sandbox" />
      <SandboxContent>
        <SandboxTabs defaultValue={isComplete ? "output" : "command"} key={part.state}>
          <SandboxTabsBar>
            <SandboxTabsList>
              <SandboxTabsTrigger value="command">Command</SandboxTabsTrigger>
              <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
            </SandboxTabsList>
          </SandboxTabsBar>
          <SandboxTabContent value="command">
            <CodeBlock code={bashCommand(part.input)} language="bash" />
          </SandboxTabContent>
          <SandboxTabContent value="output">
            <CodeBlock code={bashOutput(part)} language="log" />
          </SandboxTabContent>
        </SandboxTabs>
        {part.toolMetadata?.eve?.inputRequest ? (
          <div className="p-3">
            <InputRequestActions
              canRespond={canRespond}
              onInputResponses={onInputResponses}
              part={part}
            />
          </div>
        ) : null}
      </SandboxContent>
    </Sandbox>
  );
}

function bashCommand(input: unknown): string {
  if (
    typeof input === "object" &&
    input !== null &&
    "command" in input &&
    typeof input.command === "string"
  ) {
    return input.command;
  }

  return formatUnknown(input);
}

function bashOutput(part: EveDynamicToolPart): string {
  if (part.state === "output-error") {
    return part.errorText;
  }

  if (part.state !== "output-available") {
    return "Waiting for output…";
  }

  const output = part.output;
  if (typeof output !== "object" || output === null) {
    return formatUnknown(output);
  }

  const lines: string[] = [];
  if ("stdout" in output && typeof output.stdout === "string" && output.stdout.length > 0) {
    lines.push(output.stdout.trimEnd());
  }
  if ("stderr" in output && typeof output.stderr === "string" && output.stderr.length > 0) {
    lines.push(output.stderr.trimEnd());
  }
  if ("exitCode" in output && typeof output.exitCode === "number") {
    lines.push(`exit ${output.exitCode}`);
  }

  return lines.length > 0 ? lines.join("\n\n") : formatUnknown(output);
}

function formatUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function InputRequestActions({
  canRespond,
  onInputResponses,
  part,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveDynamicToolPart;
}) {
  const inputRequest = part.toolMetadata?.eve?.inputRequest;
  if (!inputRequest) {
    return null;
  }

  const inputResponse = part.toolMetadata?.eve?.inputResponse;
  const selectedOption = inputRequest.options?.find(
    (option) => option.id === inputResponse?.optionId,
  );

  return (
    <div className="space-y-3 rounded-md border border-amber-400 bg-amber-100 p-3">
      <p className="text-muted-foreground text-sm">{inputRequest.prompt}</p>
      {inputResponse ? (
        <p className="font-medium text-sm">
          Responded: {selectedOption?.label ?? inputResponse.text ?? inputResponse.optionId}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {inputRequest.options?.map((option) => (
            <Button
              disabled={!canRespond}
              key={option.id}
              onClick={() => {
                void onInputResponses([
                  {
                    optionId: option.id,
                    requestId: inputRequest.requestId,
                  },
                ]);
              }}
              size="sm"
              type="button"
              variant={option.style === "danger" ? "destructive" : "default"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function partKey(part: EveMessagePart, index: number): string {
  switch (part.type) {
    case "dynamic-tool":
      return part.toolCallId;
    default:
      return `${part.type}:${index}`;
  }
}
