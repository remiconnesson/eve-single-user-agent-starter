import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircle2Icon, StethoscopeIcon, TriangleAlertIcon } from "lucide-react";
import { DiagnosticActions } from "./_components/diagnostic-actions";
import { requireAuthenticatedPage } from "@/lib/auth/page";
import { readDiagnosticReport } from "@/lib/diagnostics/report";

export const metadata: Metadata = {
  title: "Diagnostics | Eve Starter",
};

const GATEWAY_LABELS = {
  "api-key-fallback": "API key fallback",
  "local-oidc": "Local OIDC token",
  missing: "Missing",
  "vercel-oidc": "Managed Vercel OIDC",
} as const;

export default async function DiagnosticsPage() {
  await requireAuthenticatedPage();
  const report = readDiagnosticReport();
  const isHealthy = report.status === "healthy";

  return (
    <main className="min-h-dvh bg-[#fafafa] px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link className="mb-8 inline-flex items-center gap-2 text-sm text-gray-900 hover:text-foreground" href="/">
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          Back to Eve
        </Link>

        <div className="rounded-lg border bg-background p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-md border border-gray-400">
              <StethoscopeIcon aria-hidden="true" className="size-4" />
            </div>
            <div>
              <p className="font-mono text-xs text-gray-800">SUPPORT REPORT</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">Diagnostics</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-900">
                Share this report when asking for help. It contains configuration status and version metadata, never passwords, tokens, prompts, or responses.
              </p>
            </div>
          </div>

          <div className={`mt-8 flex items-center gap-3 rounded-md border p-4 ${isHealthy ? "border-green-700/30 bg-green-700/5" : "border-amber-400 bg-amber-100"}`}>
            {isHealthy ? (
              <CheckCircle2Icon aria-hidden="true" className="size-5 text-green-700" />
            ) : (
              <TriangleAlertIcon aria-hidden="true" className="size-5 text-amber-700" />
            )}
            <div>
              <p className="font-medium">{isHealthy ? "Configuration looks healthy" : "Configuration needs attention"}</p>
              <p className="text-sm text-gray-900">
                {isHealthy ? "No known setup problems were detected." : `${report.diagnostics.length} issue${report.diagnostics.length === 1 ? "" : "s"} found.`}
              </p>
            </div>
          </div>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-md border bg-gray-400 sm:grid-cols-2">
            <DiagnosticField label="Platform" value={report.runtime.platform === "vercel" ? "Vercel" : "Local"} />
            <DiagnosticField label="Environment" value={report.deployment.environment} />
            <DiagnosticField label="Gateway authentication" value={GATEWAY_LABELS[report.configuration.gatewayAuthentication]} />
            <DiagnosticField label="Node.js" value={report.runtime.nodeVersion} />
            <DiagnosticField label="Region" value={report.deployment.region ?? "Not available"} />
            <DiagnosticField label="Commit" value={report.deployment.commitSha ?? "Not available"} />
          </dl>

          {report.diagnostics.length > 0 ? (
            <div className="mt-8 space-y-3">
              <h2 className="font-medium">What to fix</h2>
              {report.diagnostics.map((diagnostic) => (
                <article className="rounded-md border border-amber-400 bg-amber-100 p-4" key={diagnostic.code}>
                  <p className="font-mono text-xs text-gray-900">{diagnostic.code}</p>
                  <p className="mt-1 font-medium">{diagnostic.why}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-900">{diagnostic.fix}</p>
                  {diagnostic.docs ? (
                    <a className="mt-2 inline-block text-sm underline underline-offset-4" href={diagnostic.docs} rel="noreferrer" target="_blank">
                      Read diagnostic guide
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          <div className="mt-8 border-t pt-6">
            <DiagnosticActions report={report} />
          </div>
        </div>
      </div>
    </main>
  );
}

function DiagnosticField({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-background p-4">
      <dt className="text-xs text-gray-800">{label}</dt>
      <dd className="mt-1 break-words font-mono text-sm">{value}</dd>
    </div>
  );
}
