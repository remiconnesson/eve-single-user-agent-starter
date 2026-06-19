"use client";

import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { MAX_USER_UPLOAD_FILES } from "@/lib/user-uploads/constants";
import { mergeUserUploadFiles } from "./sandbox-file";

export function SandboxUploadControl({
  disabled,
  files,
  onFilesChange,
  onUploadError,
}: {
  readonly disabled: boolean;
  readonly files: readonly File[];
  readonly onFilesChange: (files: readonly File[]) => void;
  readonly onUploadError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2" data-user-upload-queue="true">
      <input
        aria-label="Choose files to upload"
        className="sr-only"
        disabled={disabled}
        multiple
        onChange={(event) => {
          try {
            onFilesChange(
              mergeUserUploadFiles(files, Array.from(event.currentTarget.files ?? [])),
            );
            onUploadError(null);
          } catch (error) {
            onUploadError(
              error instanceof Error ? error.message : "The files could not be added.",
            );
          } finally {
            event.currentTarget.value = "";
          }
        }}
        ref={inputRef}
        type="file"
      />
      <Button
        aria-label="Add files to sandbox"
        className="h-7 border-gray-400 px-2 text-xs shadow-none"
        disabled={disabled || files.length >= MAX_USER_UPLOAD_FILES}
        onClick={() => inputRef.current?.click()}
        title="Add up to 5 files, 1 MiB each"
        type="button"
        variant="outline"
      >
        <PaperclipIcon aria-hidden="true" className="size-3.5" />
        Add files
      </Button>
      {files.length === 0 ? (
        <span className="text-xs text-gray-800">Small files stay queued until your message.</span>
      ) : null}
      {files.map((file) => (
        <span
          className="flex min-w-0 max-w-56 items-center gap-1 rounded-md border border-gray-300 bg-gray-100 py-0.5 pr-0.5 pl-2 text-xs text-gray-900"
          key={`${file.name}:${file.size}:${file.lastModified}:${file.type}`}
        >
          <FileIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{file.name || "upload"}</span>
          <Button
            aria-label={`Remove ${file.name || "uploaded file"}`}
            className="size-6"
            disabled={disabled}
            onClick={() => {
              onFilesChange(files.filter((candidate) => candidate !== file));
              onUploadError(null);
            }}
            size="icon-sm"
            title="Remove file"
            type="button"
            variant="ghost"
          >
            <XIcon aria-hidden="true" className="size-3" />
          </Button>
        </span>
      ))}
    </div>
  );
}
