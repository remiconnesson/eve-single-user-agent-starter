import { hasValidSessionCookie } from "./session";
import { resolveAccessMode } from "./access-mode";

export type { AccessMode } from "./access-mode";
export { resolveAccessMode };

export async function hasAuthorizedAccess(cookieHeader: string | null): Promise<boolean> {
  if (resolveAccessMode() !== "password") return true;
  return hasValidSessionCookie(cookieHeader);
}
