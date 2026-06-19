import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { POST } from "./route";

const ACCESS_PASSWORD = "correct horse battery staple";

afterEach(() => {
  vi.unstubAllEnvs();
});

function loginRequest(password: string) {
  return new NextRequest("https://eve.example/api/auth/login", {
    body: new URLSearchParams({ password }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
}

describe("POST /api/auth/login", () => {
  it("sets a secure session cookie and redirects home for the correct password", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);

    const response = await POST(loginRequest(ACCESS_PASSWORD));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://eve.example/");
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("redirects back without a cookie for the wrong password", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);

    const response = await POST(loginRequest("definitely not the password"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://eve.example/login?error=invalid");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
