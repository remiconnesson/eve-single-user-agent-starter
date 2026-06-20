"use client";

import {
  InputGroup,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ChatStatus } from "ai";
import { ArrowUpIcon, XIcon } from "lucide-react";
import type {
  ComponentProps,
  FormEvent,
  FormEventHandler,
  KeyboardEventHandler,
} from "react";
import { useState } from "react";

export interface PromptInputMessage {
  readonly text: string;
}

export type PromptInputProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  readonly onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;
};

export function PromptInput({
  children,
  className,
  onSubmit,
  ...props
}: PromptInputProps) {
  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    const value = new FormData(event.currentTarget).get("message");
    const text = typeof value === "string" ? value : "";

    try {
      await onSubmit({ text }, event);
    } catch {
      // The caller owns the visible error and draft restoration.
    }
  };

  return (
    <form className="w-full" onSubmit={handleSubmit} {...props}>
      <InputGroup
        className={cn(
          "overflow-hidden rounded-2xl bg-card shadow-sm",
          "focus-within:border-foreground has-[[data-slot=input-group-control]:focus-visible]:border-foreground",
          className,
        )}
      >
        {children}
      </InputGroup>
    </form>
  );
}

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>;

export function PromptInputTextarea({
  className,
  onKeyDown,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) {
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Enter") return;
    if (isComposing || event.nativeEvent.isComposing || event.shiftKey) return;

    event.preventDefault();
    const submitButton = event.currentTarget.form?.querySelector(
      'button[type="submit"]',
    );
    if (submitButton instanceof HTMLButtonElement && submitButton.disabled) return;
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-18", className)}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
}

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  readonly status?: ChatStatus;
};

export function PromptInputSubmit({
  children,
  className,
  size = "icon-sm",
  status,
  variant = "default",
  ...props
}: PromptInputSubmitProps) {
  const isGenerating = status === "submitted" || status === "streaming";
  const icon = isGenerating ? (
    <Spinner />
  ) : status === "error" ? (
    <XIcon className="size-4" />
  ) : (
    <ArrowUpIcon className="size-4" />
  );

  return (
    <InputGroupButton
      aria-label="Submit"
      className={cn("absolute right-2.5 bottom-2.5 rounded-full", className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? icon}
    </InputGroupButton>
  );
}
