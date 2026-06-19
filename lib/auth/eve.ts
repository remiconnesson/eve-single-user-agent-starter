import type { AuthFn } from "eve/channels/auth";
import {
  hasValidSessionCookie,
} from "./session";

export function singleUserPasswordAuth(): AuthFn<Request> {
  return async (request) => {
    const isAuthenticated = await hasValidSessionCookie(request.headers.get("cookie"));
    if (!isAuthenticated) return null;

    return {
      attributes: {},
      authenticator: "password",
      principalId: "owner",
      principalType: "user",
    };
  };
}
