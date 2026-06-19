import { createRequestLogger } from "evlog";
import { defineHook } from "eve/hooks";
import {
  currentUserUploads,
  mergeUserUploads,
  syncUserUploadOriginals,
  userUploadSyncTurnState,
  userUploadsState,
} from "../lib/user-uploads";

export default defineHook({
  events: {
    async "step.started"(_event, context) {
      const current = currentUserUploads(context.session.auth.current);
      if (current.length === 0) return;
      if (userUploadSyncTurnState.get() === context.session.turn.id) return;

      const manifest = await syncUserUploadOriginals({
        current,
        sandbox: await context.getSandbox(),
      });
      userUploadsState.update((existing) => mergeUserUploads(existing, manifest));
      userUploadSyncTurnState.update(() => context.session.turn.id);

      const uploadLog = createRequestLogger({
        method: "UPLOAD",
        path: "/workspace/user_uploads",
        requestId: `${context.session.id}:${context.session.turn.id}:uploads`,
      });
      uploadLog.set({
        event: "agent.uploads_staged",
        files: {
          bytes: current.reduce((total, upload) => total + upload.byteLength, 0),
          count: current.length,
        },
        outcome: "completed",
        service: "eve-single-user-agent-starter:agent",
        session: { id: context.session.id },
        turn: { id: context.session.turn.id },
      });
      uploadLog.emit();
    },
  },
});
