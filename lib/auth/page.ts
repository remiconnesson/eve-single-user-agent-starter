import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginPathForAccessAuthorization, readAccessAuthorization } from "./access";

export async function requireAuthenticatedPage(): Promise<void> {
  const cookieStore = await cookies();
  const authorization = await readAccessAuthorization(cookieStore.toString());
  if (authorization.kind !== "authorized") {
    redirect(loginPathForAccessAuthorization(authorization));
  }
}
