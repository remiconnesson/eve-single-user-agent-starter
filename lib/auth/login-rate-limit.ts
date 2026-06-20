export const LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_RATE_LIMIT_TRACKING_WINDOW_MS = 60 * 1000;
export const LOGIN_RATE_LIMIT_BASE_BACKOFF_MS = 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_BACKOFF_MS = 60 * 60 * 1000;

type LoginRateLimitEntry =
  | {
      readonly backoffLevel: number;
      readonly failedAttempts: number;
      readonly kind: "tracking";
      readonly resetAt: number;
    }
  | {
      readonly backoffLevel: number;
      readonly kind: "limited";
      readonly resetAt: number;
    };

type LoginRateLimitInput = {
  readonly key: string;
  readonly now?: number;
};

type LoginRateLimitResult =
  | { readonly kind: "allowed" }
  | { readonly kind: "limited"; readonly retryAfterSeconds: number };

const failedLogins = new Map<string, LoginRateLimitEntry>();

export function loginRateLimitKeyFromHeaders(headers: Headers): string {
  return (
    firstHeaderValue(headers.get("x-forwarded-for")) ??
    firstHeaderValue(headers.get("x-real-ip")) ??
    "unknown"
  );
}

export function checkLoginRateLimit({
  key,
  now = Date.now(),
}: LoginRateLimitInput): LoginRateLimitResult {
  const entry = readActiveEntry({ key, now });
  if (!entry || entry.kind === "tracking") return { kind: "allowed" };

  return {
    kind: "limited",
    retryAfterSeconds: secondsUntil(entry.resetAt, now),
  };
}

export function recordFailedLogin({
  key,
  now = Date.now(),
}: LoginRateLimitInput): void {
  const current = readActiveEntry({ key, now });
  const entry =
    current?.kind === "tracking"
      ? current
      : {
          backoffLevel: 0,
          failedAttempts: 0,
          kind: "tracking" as const,
          resetAt: now + LOGIN_RATE_LIMIT_TRACKING_WINDOW_MS,
        };
  const failedAttempts = entry.failedAttempts + 1;

  if (failedAttempts >= LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS) {
    const backoffLevel = entry.backoffLevel + 1;
    failedLogins.set(key, {
      backoffLevel,
      kind: "limited",
      resetAt: now + backoffDelayMs(backoffLevel),
    });
    return;
  }

  failedLogins.set(key, {
    ...entry,
    failedAttempts,
  });
}

export function resetLoginRateLimit({ key }: { readonly key: string }): void {
  failedLogins.delete(key);
}

export function clearLoginRateLimitState(): void {
  failedLogins.clear();
}

function readActiveEntry({
  key,
  now,
}: Required<LoginRateLimitInput>): LoginRateLimitEntry | undefined {
  const entry = failedLogins.get(key);
  if (!entry) return undefined;
  if (entry.resetAt > now) return entry;

  if (entry.kind === "limited") {
    const trackingEntry = {
      backoffLevel: entry.backoffLevel,
      failedAttempts: 0,
      kind: "tracking" as const,
      resetAt: now + LOGIN_RATE_LIMIT_TRACKING_WINDOW_MS,
    };
    failedLogins.set(key, trackingEntry);
    return trackingEntry;
  }

  failedLogins.delete(key);
  return undefined;
}

function firstHeaderValue(value: string | null): string | undefined {
  const first = value?.split(",")[0]?.trim();
  return first ? first : undefined;
}

function backoffDelayMs(backoffLevel: number): number {
  return Math.min(
    LOGIN_RATE_LIMIT_BASE_BACKOFF_MS * 2 ** Math.max(0, backoffLevel - 1),
    LOGIN_RATE_LIMIT_MAX_BACKOFF_MS,
  );
}

function secondsUntil(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}
