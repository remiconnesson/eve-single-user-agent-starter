import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAccessPassword, SESSION_COOKIE_NAME, verifySessionToken } from "./session";

export async function requireAuthenticatedPage(): Promise<void> {
  const cookieStore = await cookies();
  const password = getAccessPassword();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = await verifySessionToken({ password, token });
  if (!isAuthenticated) redirect("/login");
}
