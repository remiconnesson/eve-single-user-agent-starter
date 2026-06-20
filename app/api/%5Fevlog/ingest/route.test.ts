import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, parseAccessPassword, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { POST } from "./route";

const ACCESS_PASSWORD = "correct horse battery staple";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function authenticatedRequest(body: unknown, origin = "https://eve.example") {
  const token = await createSessionToken({ password: parseAccessPassword(ACCESS_PASSWORD) });
  return new NextRequest("https://eve.example/api/_evlog/ingest", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      host: "eve.example",
      origin,
    },
    method: "POST",
  });
}

describe("POST /api/_evlog/ingest", () => {
  it("accepts same-origin client logs in Vercel Preview without a cookie", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    const request = new NextRequest("https://eve.example/api/_evlog/ingest", {
      body: JSON.stringify({
        event: "client.ready",
        level: "info",
        timestamp: "2026-06-19T12:00:00.000Z",
      }),
      headers: {
        "content-type": "application/json",
        host: "eve.example",
        origin: "https://eve.example",
      },
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
  });

  it("accepts browser-confirmed same-origin logs through a host-rewriting proxy", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    const request = new NextRequest("http://localhost:3000/api/_evlog/ingest", {
      body: JSON.stringify({
        event: "client.ready",
        level: "info",
        timestamp: "2026-06-19T12:00:00.000Z",
      }),
      headers: {
        "content-type": "application/json",
        host: "localhost:3000",
        origin: "https://v0-preview.example",
        "sec-fetch-site": "same-origin",
        "x-forwarded-host": "localhost:3000",
      },
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
  });

  it("accepts an allowlisted client diagnostic payload", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);
    const request = await authenticatedRequest({
      diagnosticCode: "EVE_R001",
      event: "agent.request_failed",
      level: "error",
      timestamp: "2026-06-19T12:00:00.000Z",
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
  });

  it("returns a friendly configuration error when the production password is missing", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", "");
    const request = new NextRequest("https://eve.example/api/_evlog/ingest", {
      body: JSON.stringify({
        event: "client.ready",
        level: "info",
        timestamp: "2026-06-19T12:00:00.000Z",
      }),
      headers: {
        "content-type": "application/json",
        host: "eve.example",
        origin: "https://eve.example",
      },
      method: "POST",
    });

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: "App is not configured" });
    expect(response.status).toBe(503);
  });

  it("rejects requests from another origin", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);
    const request = await authenticatedRequest(
      { event: "test", level: "info", timestamp: "2026-06-19T12:00:00.000Z" },
      "https://attacker.example",
    );

    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("rejects requests the browser identifies as cross-site", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);
    const request = await authenticatedRequest({
      event: "test",
      level: "info",
      timestamp: "2026-06-19T12:00:00.000Z",
    });
    request.headers.set("sec-fetch-site", "cross-site");

    const response = await POST(request);

    expect(response.status).toBe(403);
  });
});
