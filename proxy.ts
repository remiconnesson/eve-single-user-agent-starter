import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  loginPathForAccessAuthorization,
  readAccessAuthorization,
} from "@/lib/auth/access";

export async function proxy(request: NextRequest) {
  const authorization = await readAccessAuthorization(request.headers.get("cookie"));
  if (authorization.kind === "authorized") {
    return NextResponse.next();
  }
  return NextResponse.redirect(
    new URL(loginPathForAccessAuthorization(authorization), request.url),
  );
}

export const config = {
  matcher: ["/"],
};
