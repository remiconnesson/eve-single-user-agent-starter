import { defineInstructions } from "eve/instructions";
import { defineDynamic } from "eve/tools";
import {
  currentUserUploads,
  mergeUserUploads,
  renderUserUploadInstructions,
  userUploadsState,
} from "../lib/user-uploads";

export default defineDynamic({
  events: {
    async "turn.started"(_event, context) {
      const current = currentUserUploads(context.session.auth.current);
      const uploads = mergeUserUploads(userUploadsState.get(), current);
      if (uploads.length === 0) return null;

      return defineInstructions({
        markdown: renderUserUploadInstructions(uploads),
      });
    },
  },
});
