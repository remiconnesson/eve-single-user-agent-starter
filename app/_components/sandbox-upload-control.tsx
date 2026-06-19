"use client";

import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import {
  PromptInputButton,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";

export function SandboxUploadControl({
  disabled,
  onClearError,
}: {
  readonly disabled: boolean;
  readonly onClearError: () => void;
}) {
  const attachments = usePromptInputAttachments();
  const file = attachments.files[0];

  if (!file) {
    return (
      <PromptInputTools>
        <PromptInputButton
          aria-label="Upload file to sandbox"
          disabled={disabled}
          onClick={() => {
            onClearError();
            attachments.openFileDialog();
          }}
          title="Upload one file, up to 3 MiB"
        >
          <PaperclipIcon aria-hidden="true" />
        </PromptInputButton>
      </PromptInputTools>
    );
  }

  return (
    <PromptInputTools className="max-w-[calc(100%-3rem)]">
      <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-900">
        <FileIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{file.filename || "upload"}</span>
      </span>
      <PromptInputButton
        aria-label={`Remove ${file.filename || "uploaded file"}`}
        disabled={disabled}
        onClick={() => {
          attachments.remove(file.id);
          onClearError();
        }}
        size="icon-xs"
        title="Remove file"
      >
        <XIcon aria-hidden="true" />
      </PromptInputButton>
    </PromptInputTools>
  );
}
