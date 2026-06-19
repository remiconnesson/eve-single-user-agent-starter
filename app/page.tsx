import { AgentChat } from "@/app/_components/agent-chat";
import { requireAuthenticatedPage } from "@/lib/auth/page";

export default async function Page() {
  await requireAuthenticatedPage();

  return <AgentChat />;
}
