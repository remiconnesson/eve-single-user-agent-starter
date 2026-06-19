import type { AuthFn } from "eve/channels/auth";
import {
  getAccessPassword,
  readCookie,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "./session";

export function singleUserPasswordAuth(): AuthFn<Request> {
  return async (request) => {
    const password = getAccessPassword();
    const token = readCookie({
      cookieHeader: request.headers.get("cookie"),
      name: SESSION_COOKIE_NAME,
    });
    const isAuthenticated = await verifySessionToken({ password, token });
    if (!isAuthenticated) return null;

    return {
      attributes: {},
      authenticator: "password",
      principalId: "owner",
      principalType: "user",
    };
  };
}
