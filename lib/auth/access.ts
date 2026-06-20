import { Diagnostic } from "nostics";
import { diagnostics } from "@/lib/diagnostics/catalog";
import { hasValidSessionCookie } from "./session";
import { resolveAccessMode } from "./access-mode";

export { resolveAccessMode };

export type AccessAuthorization =
  | { readonly kind: "authorized" }
  | { readonly kind: "misconfigured"; readonly diagnostic: Diagnostic }
  | { readonly kind: "unauthorized" };

export async function readAccessAuthorization(
  cookieHeader: string | null,
): Promise<AccessAuthorization> {
  if (resolveAccessMode() !== "password") return { kind: "authorized" };

  try {
    return (await hasValidSessionCookie(cookieHeader))
      ? { kind: "authorized" }
      : { kind: "unauthorized" };
  } catch (error) {
    if (isAccessPasswordMissing(error)) {
      return { diagnostic: error, kind: "misconfigured" };
    }
    throw error;
  }
}

export function loginPathForAccessAuthorization(
  authorization: Exclude<AccessAuthorization, { readonly kind: "authorized" }>,
): string {
  switch (authorization.kind) {
    case "misconfigured":
      return "/login?error=configuration";
    case "unauthorized":
      return "/login";
  }
}

function isAccessPasswordMissing(error: unknown): error is Diagnostic {
  return error instanceof Diagnostic && error.name === diagnostics.EVE_C001().name;
}
