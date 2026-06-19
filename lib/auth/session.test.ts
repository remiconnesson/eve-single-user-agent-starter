import { describe, expect, it } from "vitest";
import {
  ACCESS_PASSWORD_MIN_LENGTH,
  createSessionToken,
  matchesAccessPassword,
  parseAccessPassword,
  readCookie,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  verifySessionToken,
} from "./session";

const ACCESS_PASSWORD = "correct horse battery staple";
const OTHER_PASSWORD = "another long private passphrase";
const NOW = Date.UTC(2026, 5, 19, 12);

describe("parseAccessPassword", () => {
  it("accepts and trims a sufficiently long password", () => {
    expect(parseAccessPassword(`  ${ACCESS_PASSWORD}  `)).toBe(ACCESS_PASSWORD);
  });

  it("rejects missing and short passwords", () => {
    expect(() => parseAccessPassword(undefined)).toThrow("EVE_ACCESS_PASSWORD is required");
    expect(() => parseAccessPassword("x".repeat(ACCESS_PASSWORD_MIN_LENGTH - 1))).toThrow(
      `at least ${ACCESS_PASSWORD_MIN_LENGTH} characters`,
    );
  });
});

describe("session tokens", () => {
  it("accepts a valid token before it expires", async () => {
    const password = parseAccessPassword(ACCESS_PASSWORD);
    const token = await createSessionToken({ now: NOW, password });

    await expect(
      verifySessionToken({ now: NOW + SESSION_TTL_MS - 1, password, token }),
    ).resolves.toBe(true);
  });

  it("rejects expired, tampered, and differently signed tokens", async () => {
    const password = parseAccessPassword(ACCESS_PASSWORD);
    const token = await createSessionToken({ now: NOW, password });
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(
      verifySessionToken({ now: NOW + SESSION_TTL_MS, password, token }),
    ).resolves.toBe(false);
    await expect(verifySessionToken({ now: NOW, password, token: tamperedToken })).resolves.toBe(
      false,
    );
    await expect(
      verifySessionToken({
        now: NOW,
        password: parseAccessPassword(OTHER_PASSWORD),
        token,
      }),
    ).resolves.toBe(false);
  });

  it("rejects malformed tokens without throwing", async () => {
    const password = parseAccessPassword(ACCESS_PASSWORD);

    await expect(verifySessionToken({ now: NOW, password, token: undefined })).resolves.toBe(
      false,
    );
    await expect(verifySessionToken({ now: NOW, password, token: "not-a-token" })).resolves.toBe(
      false,
    );
  });
});

describe("password and cookie helpers", () => {
  it("compares candidate passwords without exposing the stored password", () => {
    const password = parseAccessPassword(ACCESS_PASSWORD);

    expect(matchesAccessPassword({ candidate: ACCESS_PASSWORD, password })).toBe(true);
    expect(matchesAccessPassword({ candidate: OTHER_PASSWORD, password })).toBe(false);
  });

  it("reads the session cookie without matching similarly named cookies", () => {
    expect(
      readCookie({
        cookieHeader: `other=1; ${SESSION_COOKIE_NAME}=signed-token; ${SESSION_COOKIE_NAME}_old=nope`,
        name: SESSION_COOKIE_NAME,
      }),
    ).toBe("signed-token");
    expect(readCookie({ cookieHeader: null, name: SESSION_COOKIE_NAME })).toBeUndefined();
  });
});
