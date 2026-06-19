import type { AuthFn } from "eve/channels/auth";
import { resolveAccessMode } from "./access";
import { hasValidSessionCookie } from "./session";

type OwnerPrincipal = Exclude<
  Awaited<ReturnType<AuthFn<Request>>>,
  null | undefined
>;

export function singleUserPasswordAuth(): AuthFn<Request> {
  return async (request) => {
    const accessMode = resolveAccessMode();
    if (accessMode !== "password") {
      return ownerPrincipal(accessMode);
    }

    const isAuthenticated = await hasValidSessionCookie(request.headers.get("cookie"));
    if (!isAuthenticated) return null;

    return ownerPrincipal("password");
  };
}

function ownerPrincipal(
  authenticator: "development" | "password" | "preview",
): OwnerPrincipal {
  return {
    attributes: {},
    authenticator,
    principalId: "owner",
    principalType: "user",
  };
}
