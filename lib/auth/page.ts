import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasAuthorizedAccess } from "./access";

export async function requireAuthenticatedPage(): Promise<void> {
  const cookieStore = await cookies();
  if (!(await hasAuthorizedAccess(cookieStore.toString()))) redirect("/login");
}
