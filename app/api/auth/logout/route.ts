import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { useLogger, withEvlog } from "@/lib/evlog";

export const POST = withEvlog((request: NextRequest) => {
  useLogger().set({ authentication: { outcome: "signed_out", principalId: "owner" } });
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.headers.set("cache-control", "no-store");
  response.cookies.set({
    httpOnly: true,
    maxAge: 0,
    name: SESSION_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    value: "",
  });
  return response;
});
