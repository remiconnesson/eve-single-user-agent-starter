import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getAccessPassword,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const password = getAccessPassword();
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = await verifySessionToken({ password, token });

  if (isAuthenticated) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/"],
};
