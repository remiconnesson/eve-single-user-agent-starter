import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Diagnostic } from "nostics";
import { resolveAccessMode } from "@/lib/auth/access";
import {
  checkLoginRateLimit,
  loginRateLimitKeyFromHeaders,
  recordFailedLogin,
  resetLoginRateLimit,
} from "@/lib/auth/login-rate-limit";
import {
  createSessionToken,
  getAccessPassword,
  matchesAccessPassword,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/auth/session";
import { toDiagnosticLogFields } from "@/lib/diagnostics/catalog";
import { useLogger, withEvlog } from "@/lib/evlog";

export const POST = withEvlog(async (request: NextRequest) => {
  const requestLog = useLogger();
  const accessMode = resolveAccessMode();
  if (accessMode !== "password") {
    requestLog.set({
      authentication: {
        outcome: "bypassed",
        persistence: accessMode,
        principalId: "owner",
      },
    });
    return redirectToHome(request);
  }

  const rateLimitKey = loginRateLimitKeyFromHeaders(request.headers);
  const rateLimit = checkLoginRateLimit({ key: rateLimitKey });
  if (rateLimit.kind === "limited") {
    requestLog.set({
      authentication: {
        outcome: "rate_limited",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
    });
    return redirectToLogin({
      error: "rate_limited",
      request,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
  }

  const formData = await request.formData();
  const candidate = formData.get("password");
  const rememberMe = formData.get("rememberMe") === "on";
  let password: string;
  try {
    password = getAccessPassword();
  } catch (error) {
    if (error instanceof Diagnostic) {
      requestLog.error(error, {
        authentication: {
          diagnostic: toDiagnosticLogFields(error),
          outcome: "misconfigured",
        },
      });
      return redirectToLogin({ error: "configuration", request });
    }
    throw error;
  }

  if (typeof candidate !== "string" || !matchesAccessPassword({ candidate, password })) {
    recordFailedLogin({ key: rateLimitKey });
    requestLog.set({ authentication: { outcome: "denied", reason: "invalid_password" } });
    return redirectToLogin({ error: "invalid", request });
  }

  resetLoginRateLimit({ key: rateLimitKey });
  requestLog.set({
    authentication: {
      outcome: "authenticated",
      persistence: rememberMe ? "30_days" : "browser_session",
      principalId: "owner",
    },
  });
  const response = redirectToHome(request);
  response.cookies.set({
    httpOnly: true,
    ...(rememberMe ? { maxAge: SESSION_TTL_MS / 1000 } : {}),
    name: SESSION_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    value: await createSessionToken({ password }),
  });
  return response;
});

function redirectToHome(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.headers.set("cache-control", "no-store");
  return response;
}

function redirectToLogin({
  error,
  request,
  retryAfterSeconds,
}: {
  readonly error: string;
  readonly request: NextRequest;
  readonly retryAfterSeconds?: number;
}) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  const response = NextResponse.redirect(loginUrl, 303);
  response.headers.set("cache-control", "no-store");
  if (retryAfterSeconds !== undefined) {
    response.headers.set("retry-after", String(retryAfterSeconds));
  }
  return response;
}
