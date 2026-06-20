import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearLoginRateLimitState } from "@/lib/auth/login-rate-limit";
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from "@/lib/auth/session";
import { POST } from "./route";

const ACCESS_PASSWORD = "correct horse battery staple";

afterEach(() => {
  clearLoginRateLimitState();
  vi.unstubAllEnvs();
});

function loginRequest(
  password: string,
  rememberMe = false,
  ipAddress = "203.0.113.10",
) {
  const body = new URLSearchParams({ password });
  if (rememberMe) body.set("rememberMe", "on");
  return new NextRequest("https://eve.example/api/auth/login", {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ipAddress,
    },
    method: "POST",
  });
}

describe("POST /api/auth/login", () => {
  it("bypasses login in Vercel Preview", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", "");
    vi.stubEnv("VERCEL_ENV", "preview");

    const response = await POST(loginRequest(""));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://eve.example/");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets a secure browser-session cookie by default", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);

    const response = await POST(loginRequest(ACCESS_PASSWORD));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://eve.example/");
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("set-cookie")).not.toContain("Max-Age");
    expect(response.headers.get("set-cookie")).not.toContain("Expires");
  });

  it("keeps the session for 30 days when remember me is selected", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);

    const response = await POST(loginRequest(ACCESS_PASSWORD, true));

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain(
      `Max-Age=${SESSION_TTL_MS / 1000}`,
    );
  });

  it("redirects back without a cookie for the wrong password", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);

    const response = await POST(loginRequest("definitely not the password"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://eve.example/login?error=invalid");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rate limits repeated wrong passwords from the same client", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(loginRequest("definitely not the password"));
      expect(response.headers.get("location")).toBe("https://eve.example/login?error=invalid");
    }

    const response = await POST(loginRequest("definitely not the password"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://eve.example/login?error=rate_limited",
    );
    expect(response.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears failed-login attempts after a successful login", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await POST(loginRequest("definitely not the password"));
    }

    await POST(loginRequest(ACCESS_PASSWORD));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(loginRequest("definitely not the password"));
      expect(response.headers.get("location")).toBe("https://eve.example/login?error=invalid");
    }
  });

  it("keeps configuration diagnostics in logs", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", "");

    const response = await POST(loginRequest(ACCESS_PASSWORD));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://eve.example/login?error=configuration",
    );
  });
});
