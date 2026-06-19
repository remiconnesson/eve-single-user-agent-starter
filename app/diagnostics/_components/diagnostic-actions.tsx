"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { log } from "evlog/next/client";
import { Button } from "@/components/ui/button";
import type { DiagnosticReport } from "@/lib/diagnostics/report";

export function DiagnosticActions({ report }: { readonly report: DiagnosticReport }) {
  const [copied, setCopied] = useState(false);
  const serializedReport = JSON.stringify(report, null, 2);

  const copyReport = async () => {
    await navigator.clipboard.writeText(serializedReport);
    setCopied(true);
    log.info({ event: "diagnostics.report_copied" });
    window.setTimeout(() => setCopied(false), 2000);
  };

  const downloadReport = () => {
    const url = URL.createObjectURL(
      new Blob([serializedReport], { type: "application/json;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `eve-diagnostics-${report.generatedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    log.info({ event: "diagnostics.report_downloaded" });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => void copyReport()} type="button">
        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        {copied ? "Copied" : "Copy Report"}
      </Button>
      <Button onClick={downloadReport} type="button" variant="outline">
        <DownloadIcon aria-hidden="true" />
        Download JSON
      </Button>
    </div>
  );
}
