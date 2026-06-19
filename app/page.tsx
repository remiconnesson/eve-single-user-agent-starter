import { AgentChat } from "@/app/_components/chat-history-shell";
import agent from "@/agent/agent";
import { requireAuthenticatedPage } from "@/lib/auth/page";

export default async function Page() {
  await requireAuthenticatedPage();

  return (
    <AgentChat
      model={agent.model}
      stopButtonEnabled={process.env.EVE_ENABLE_STOP_BUTTON === "1"}
    />
  );
}
