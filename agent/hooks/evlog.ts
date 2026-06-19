import { createRequestLogger } from "evlog";
import { defineHook } from "eve/hooks";
import { emptyTurnObservation, turnObservation } from "../lib/turn-observation";

export default defineHook({
  events: {
    "turn.started"(event) {
      turnObservation.update(() => emptyTurnObservation(event.data.turnId));
    },
    "message.received"(event) {
      turnObservation.update((current) => ({
        ...current,
        inputCharacters: current.inputCharacters + event.data.message.length,
      }));
    },
    "actions.requested"(event) {
      const names = event.data.actions.map(actionName);
      turnObservation.update((current) => ({
        ...current,
        actionNames: [...current.actionNames, ...names],
      }));
    },
    "action.result"(event) {
      if (event.data.status === "completed") return;
      turnObservation.update((current) => ({
        ...current,
        actionErrors: current.actionErrors + 1,
      }));
    },
    "message.completed"(event) {
      turnObservation.update((current) => ({
        ...current,
        outputCharacters: current.outputCharacters + (event.data.message?.length ?? 0),
      }));
    },
    "step.completed"(event) {
      turnObservation.update((current) => ({
        ...current,
        cacheReadTokens: current.cacheReadTokens + (event.data.usage?.cacheReadTokens ?? 0),
        cacheWriteTokens: current.cacheWriteTokens + (event.data.usage?.cacheWriteTokens ?? 0),
        inputTokens: current.inputTokens + (event.data.usage?.inputTokens ?? 0),
        outputTokens: current.outputTokens + (event.data.usage?.outputTokens ?? 0),
        steps: current.steps + 1,
      }));
    },
    "turn.completed"(event, context) {
      emitTurn({ context, outcome: "completed", turnId: event.data.turnId });
    },
    "turn.failed"(event, context) {
      emitTurn({
        context,
        failure: { code: event.data.code, message: event.data.message },
        outcome: "failed",
        turnId: event.data.turnId,
      });
    },
  },
});

type ObservableAction =
  | { readonly kind: "load-skill" }
  | { readonly kind: "remote-agent-call"; readonly remoteAgentName: string }
  | { readonly kind: "subagent-call"; readonly subagentName: string }
  | { readonly kind: "tool-call"; readonly toolName: string };

function actionName(action: ObservableAction): string {
  switch (action.kind) {
    case "load-skill":
      return "load_skill";
    case "remote-agent-call":
      return action.remoteAgentName;
    case "subagent-call":
      return action.subagentName;
    case "tool-call":
      return action.toolName;
  }

  const exhaustiveAction: never = action;
  return exhaustiveAction;
}

function emitTurn({
  context,
  failure,
  outcome,
  turnId,
}: {
  readonly context: {
    readonly agent: { readonly name: string };
    readonly channel: { readonly kind?: string };
    readonly session: { readonly id: string };
  };
  readonly failure?: { readonly code: string; readonly message: string };
  readonly outcome: "completed" | "failed";
  readonly turnId: string;
}) {
  const observation = turnObservation.get();
  const turnLog = createRequestLogger({
    method: "AGENT",
    path: "/eve/turn",
    requestId: `${context.session.id}:${turnId}`,
  });
  turnLog.set({
    agent: { name: context.agent.name },
    ai: {
      cacheReadTokens: observation.cacheReadTokens,
      cacheWriteTokens: observation.cacheWriteTokens,
      inputTokens: observation.inputTokens,
      outputTokens: observation.outputTokens,
      steps: observation.steps,
    },
    channel: { kind: context.channel.kind ?? "unknown" },
    content: {
      inputCharacters: observation.inputCharacters,
      outputCharacters: observation.outputCharacters,
    },
    outcome,
    service: "eve-single-user-agent-starter:agent",
    session: { id: context.session.id },
    tools: {
      errors: observation.actionErrors,
      names: observation.actionNames,
      requested: observation.actionNames.length,
    },
    turn: { id: turnId },
  });
  if (failure) {
    turnLog.error(new Error(failure.message), { failure: { code: failure.code } });
  }
  turnLog.emit();
  turnObservation.update(() => emptyTurnObservation());
}
