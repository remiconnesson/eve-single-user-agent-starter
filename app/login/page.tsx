import type { Metadata } from "next";
import { KeyRoundIcon, TerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCESS_PASSWORD_MIN_LENGTH } from "@/lib/auth/session";
import { getPublicDiagnostic } from "@/lib/diagnostics/catalog";

export const metadata: Metadata = {
  title: "Sign In | Eve Single-User Agent Starter",
};

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly error?: string }>;
}) {
  const { error } = await searchParams;
  const configurationDiagnostic = getPublicDiagnostic(error);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#fafafa] px-4 py-12 text-foreground">
      <div aria-hidden="true" className="geist-grid pointer-events-none absolute inset-0 opacity-70" />
      <section className="relative w-full max-w-sm rounded-lg border bg-background p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)] sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-foreground text-background">
            <TerminalIcon aria-hidden="true" className="size-4" />
          </div>
          <div className="text-sm">
            <p className="font-semibold tracking-[-0.01em]">eve / single user</p>
            <p className="text-xs text-gray-800">Private workspace</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-4 grid size-9 place-items-center rounded-md border border-gray-400">
            <KeyRoundIcon aria-hidden="true" className="size-4" />
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Enter your access password</h1>
          <p className="mt-2 text-sm leading-6 text-gray-900">
            Use the private password chosen when this Eve workspace was deployed.
          </p>
        </div>

        <form action="/api/auth/login" className="space-y-3" method="post">
          <input
            aria-hidden="true"
            autoComplete="username"
            className="sr-only"
            name="username"
            readOnly
            tabIndex={-1}
            type="text"
            value="owner"
          />
          <div>
            <label className="sr-only" htmlFor="password">
              Access password
            </label>
            <Input
              aria-describedby={error === "invalid" ? "login-error" : undefined}
              autoComplete="current-password"
              autoFocus
              id="password"
              minLength={ACCESS_PASSWORD_MIN_LENGTH}
              name="password"
              placeholder="Access password"
              required
              type="password"
            />
          </div>
          {error === "invalid" ? (
            <p className="text-sm text-red-900" id="login-error" role="alert">
              That password is not correct. Try again.
            </p>
          ) : null}
          {configurationDiagnostic ? (
            <div className="rounded-md border border-red-400 bg-red-100 p-3" role="alert">
              <p className="font-mono text-xs text-red-900">{configurationDiagnostic.code}</p>
              <p className="mt-1 text-sm font-medium text-red-1000">
                {configurationDiagnostic.why}
              </p>
              <p className="mt-1 text-sm leading-5 text-red-900">
                {configurationDiagnostic.fix}
              </p>
            </div>
          ) : null}
          <Button className="w-full" type="submit">
            Continue
          </Button>
        </form>
      </section>
    </main>
  );
}
