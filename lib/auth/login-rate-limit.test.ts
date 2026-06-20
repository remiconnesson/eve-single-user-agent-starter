import { afterEach, describe, expect, it } from "vitest";
import {
  checkLoginRateLimit,
  clearLoginRateLimitState,
  LOGIN_RATE_LIMIT_BASE_BACKOFF_MS,
  LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS,
  LOGIN_RATE_LIMIT_TRACKING_WINDOW_MS,
  loginRateLimitKeyFromHeaders,
  recordFailedLogin,
  resetLoginRateLimit,
} from "./login-rate-limit";

afterEach(() => {
  clearLoginRateLimitState();
});

describe("login rate limiting", () => {
  it("blocks a key for one minute after repeated failed attempts", () => {
    const key = "203.0.113.10";
    const now = 1_000;

    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS; attempt += 1) {
      recordFailedLogin({ key, now });
    }

    expect(checkLoginRateLimit({ key, now })).toEqual({
      kind: "limited",
      retryAfterSeconds: LOGIN_RATE_LIMIT_BASE_BACKOFF_MS / 1000,
    });
    expect(
      checkLoginRateLimit({ key, now: now + LOGIN_RATE_LIMIT_BASE_BACKOFF_MS }),
    ).toEqual({ kind: "allowed" });
  });

  it("uses exponential backoff for repeated failed bursts", () => {
    const key = "203.0.113.10";
    const firstBurstAt = 1_000;
    const secondBurstAt = firstBurstAt + LOGIN_RATE_LIMIT_BASE_BACKOFF_MS;

    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS; attempt += 1) {
      recordFailedLogin({ key, now: firstBurstAt });
    }
    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS; attempt += 1) {
      recordFailedLogin({ key, now: secondBurstAt });
    }

    expect(checkLoginRateLimit({ key, now: secondBurstAt })).toEqual({
      kind: "limited",
      retryAfterSeconds: (LOGIN_RATE_LIMIT_BASE_BACKOFF_MS * 2) / 1000,
    });
  });

  it("resets tracking failures after one quiet minute", () => {
    const key = "203.0.113.10";
    const firstAttemptAt = 1_000;
    const nextWindowAt = firstAttemptAt + LOGIN_RATE_LIMIT_TRACKING_WINDOW_MS;

    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS - 1; attempt += 1) {
      recordFailedLogin({ key, now: firstAttemptAt });
    }
    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS - 1; attempt += 1) {
      recordFailedLogin({ key, now: nextWindowAt });
    }

    expect(checkLoginRateLimit({ key, now: nextWindowAt })).toEqual({ kind: "allowed" });
  });

  it("resets a key after a successful login", () => {
    const key = "203.0.113.10";

    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT_MAX_FAILED_ATTEMPTS; attempt += 1) {
      recordFailedLogin({ key });
    }
    resetLoginRateLimit({ key });

    expect(checkLoginRateLimit({ key })).toEqual({ kind: "allowed" });
  });

  it("uses the first forwarded IP address as the client key", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 198.51.100.4",
      "x-real-ip": "198.51.100.5",
    });

    expect(loginRateLimitKeyFromHeaders(headers)).toBe("203.0.113.10");
  });
});
