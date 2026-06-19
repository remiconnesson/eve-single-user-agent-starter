import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Diagnostic } from "nostics";
import {
  createSessionToken,
  getAccessPassword,
  matchesAccessPassword,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/auth/session";
import { useLogger, withEvlog } from "@/lib/evlog";

export const POST = withEvlog(async (request: NextRequest) => {
  const requestLog = useLogger();
  const formData = await request.formData();
  const candidate = formData.get("password");
  let password: string;
  try {
    password = getAccessPassword();
  } catch (error) {
    if (error instanceof Diagnostic) {
      requestLog.set({ authentication: { diagnosticCode: error.name, outcome: "misconfigured" } });
      return redirectToLogin({ error: error.name, request });
    }
    throw error;
  }

  if (typeof candidate !== "string" || !matchesAccessPassword({ candidate, password })) {
    requestLog.set({ authentication: { outcome: "denied", reason: "invalid_password" } });
    return redirectToLogin({ error: "invalid", request });
  }

  requestLog.set({ authentication: { outcome: "authenticated", principalId: "owner" } });
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.headers.set("cache-control", "no-store");
  response.cookies.set({
    httpOnly: true,
    maxAge: SESSION_TTL_MS / 1000,
    name: SESSION_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    value: await createSessionToken({ password }),
  });
  return response;
});

function redirectToLogin({
  error,
  request,
}: {
  readonly error: string;
  readonly request: NextRequest;
}) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  const response = NextResponse.redirect(loginUrl, 303);
  response.headers.set("cache-control", "no-store");
  return response;
}
