import type { IngestPayload } from "evlog";
import type { NextRequest } from "next/server";
import { hasValidSessionCookie } from "@/lib/auth/session";
import { useLogger, withEvlog } from "@/lib/evlog";

export const POST = withEvlog(async (request: NextRequest) => {
  const requestLog = useLogger();
  if (!(await hasValidSessionCookie(request.headers.get("cookie")))) {
    requestLog.set({ clientLog: { outcome: "denied" } });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasValidOrigin(request)) {
    requestLog.set({ clientLog: { outcome: "rejected", reason: "invalid_origin" } });
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }

  const payload: unknown = await request.json().catch(() => undefined);
  if (!isIngestPayload(payload)) {
    requestLog.set({ clientLog: { outcome: "rejected", reason: "invalid_payload" } });
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const clientLog = {
    diagnosticCode: readOptionalString(payload.diagnosticCode),
    errorName: readOptionalString(payload.errorName),
    event: readOptionalString(payload.event),
    level: payload.level,
    messageLength: readOptionalNumber(payload.messageLength),
    timestamp: payload.timestamp,
  };

  requestLog.set({ clientLog: { ...clientLog, outcome: "accepted" } });
  if (payload.level === "error") {
    requestLog.error(new Error("Client reported an error"), { clientLog });
  } else if (payload.level === "warn") {
    requestLog.warn("Client reported a warning", { clientLog });
  }

  return new Response(null, { status: 204 });
});

function hasValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const expectedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!expectedHost) return false;

  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

function isIngestPayload(value: unknown): value is IngestPayload {
  if (typeof value !== "object" || value === null) return false;
  if (!("timestamp" in value) || typeof value.timestamp !== "string") return false;
  if (value.timestamp.length > 64 || Number.isNaN(Date.parse(value.timestamp))) return false;
  if (!("level" in value) || typeof value.level !== "string") return false;
  return isLogLevel(value.level);
}

function isLogLevel(value: string): value is IngestPayload["level"] {
  return value === "debug" || value === "error" || value === "info" || value === "warn";
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value.slice(0, 120) : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
