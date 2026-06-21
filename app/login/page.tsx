import type { Metadata } from "next";
import { KeyRoundIcon, TerminalIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveAccessMode } from "@/lib/auth/access";

export const metadata: Metadata = {
  title: "Sign In | eve Single-User Agent Starter",
};

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly error?: string }>;
}) {
  if (resolveAccessMode() !== "password") redirect("/");

  const { error } = await searchParams;
  const errorMessage =
    error === "invalid"
      ? "That password is not correct. Try again."
      : error === "configuration"
        ? "The app is not configured. Check the server logs."
        : error === "rate_limited"
          ? "Too many incorrect attempts. Wait a few minutes, then try again."
        : undefined;

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
            Use the private password chosen when this eve workspace was deployed.
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
              aria-describedby={errorMessage ? "login-error" : undefined}
              autoComplete="current-password"
              autoFocus
              id="password"
              name="password"
              placeholder="Access password"
              required
              type="password"
            />
          </div>
          {errorMessage ? (
            <p className="text-sm text-red-900" id="login-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className="flex items-center gap-2 py-1">
            <input
              className="size-4 rounded border-gray-500 accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              id="remember-me"
              name="rememberMe"
              type="checkbox"
            />
            <label className="text-sm text-gray-900" htmlFor="remember-me">
              Remember me for 30 days
            </label>
          </div>
          <Button className="w-full" type="submit">
            Continue
          </Button>
        </form>
      </section>
    </main>
  );
}
