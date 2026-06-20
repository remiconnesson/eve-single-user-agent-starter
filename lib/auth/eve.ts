import type { AuthFn } from "eve/channels/auth";
import { readAccessAuthorization, resolveAccessMode } from "./access";

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

    const authorization = await readAccessAuthorization(request.headers.get("cookie"));
    return authorization.kind === "authorized" ? ownerPrincipal("password") : null;
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
