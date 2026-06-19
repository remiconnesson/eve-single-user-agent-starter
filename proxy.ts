import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasAuthorizedAccess } from "@/lib/auth/access";

export async function proxy(request: NextRequest) {
  if (await hasAuthorizedAccess(request.headers.get("cookie"))) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/"],
};
