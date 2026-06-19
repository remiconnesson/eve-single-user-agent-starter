"use client";

import { SquareIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { InputGroupButton } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type StopStatus = "submitted" | "streaming";

export type PromptInputStopProps = Omit<
  ComponentProps<typeof InputGroupButton>,
  "onClick" | "type"
> & {
  readonly onStop: () => void;
  readonly status: StopStatus;
};

export function PromptInputStop({
  children,
  className,
  onStop,
  size = "icon-sm",
  status,
  variant = "default",
  ...props
}: PromptInputStopProps) {
  return (
    <InputGroupButton
      aria-label="Stop"
      className={cn("absolute right-2.5 bottom-2.5 rounded-full", className)}
      onClick={onStop}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children ??
        (status === "submitted" ? <Spinner /> : <SquareIcon className="size-4" />)}
    </InputGroupButton>
  );
}
