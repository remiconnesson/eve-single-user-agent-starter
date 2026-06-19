import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AgentChat } from "@/app/_components/agent-chat";
import {
  getAccessPassword,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/session";

export default async function Page() {
  const cookieStore = await cookies();
  const password = getAccessPassword();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = await verifySessionToken({ password, token });
  if (!isAuthenticated) redirect("/login");

  return <AgentChat />;
}
