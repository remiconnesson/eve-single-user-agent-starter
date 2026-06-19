import { createHash, timingSafeEqual } from "node:crypto";
import { diagnostics } from "@/lib/diagnostics/catalog";

export const SESSION_COOKIE_NAME = "eve_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SESSION_TOKEN_VERSION = "v1";
const encoder = new TextEncoder();

export function parseAccessPassword(rawPassword: string | undefined): string {
  const password = rawPassword?.trim();
  if (!password) {
    throw diagnostics.EVE_C001();
  }
  return password;
}

export function getAccessPassword(): string {
  return parseAccessPassword(process.env.EVE_ACCESS_PASSWORD);
}

export async function hasValidSessionCookie(cookieHeader: string | null): Promise<boolean> {
  const password = getAccessPassword();
  const token = readCookie({ cookieHeader, name: SESSION_COOKIE_NAME });
  return verifySessionToken({ password, token });
}

export function matchesAccessPassword({
  candidate,
  password,
}: {
  readonly candidate: string;
  readonly password: string;
}): boolean {
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const passwordDigest = createHash("sha256").update(password).digest();
  return timingSafeEqual(candidateDigest, passwordDigest);
}

export async function createSessionToken({
  now = Date.now(),
  password,
}: {
  readonly now?: number;
  readonly password: string;
}): Promise<string> {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = `${SESSION_TOKEN_VERSION}.${expiresAt}`;
  const signature = await sign({ password, payload });
  return `${payload}.${encodeBase64Url(signature)}`;
}

export async function verifySessionToken({
  now = Date.now(),
  password,
  token,
}: {
  readonly now?: number;
  readonly password: string;
  readonly token: string | undefined;
}): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [version, rawExpiresAt, rawSignature] = parts;
  if (version !== SESSION_TOKEN_VERSION || !/^\d+$/.test(rawExpiresAt)) return false;

  const expiresAt = Number(rawExpiresAt);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const signature = decodeBase64Url(rawSignature);
  if (!signature) return false;

  const key = await importSigningKey(password);
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(`${version}.${rawExpiresAt}`),
  );
}

export function readCookie({
  cookieHeader,
  name,
}: {
  readonly cookieHeader: string | null;
  readonly name: string;
}): string | undefined {
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(";")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;

    const cookieName = pair.slice(0, separatorIndex).trim();
    if (cookieName === name) return pair.slice(separatorIndex + 1).trim();
  }

  return undefined;
}

async function sign({
  password,
  payload,
}: {
  readonly password: string;
  readonly payload: string;
}): Promise<ArrayBuffer> {
  const key = await importSigningKey(password);
  return crypto.subtle.sign("HMAC", key, encoder.encode(payload));
}

function importSigningKey(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

function encodeBase64Url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

function decodeBase64Url(value: string): ArrayBuffer | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return undefined;

  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== value) {
    return undefined;
  }

  const signature = new ArrayBuffer(bytes.length);
  new Uint8Array(signature).set(bytes);
  return signature;
}
