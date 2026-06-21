import { defaultEveAuth, eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";
import { singleUserPasswordAuth } from "../../lib/auth/eve";
import { MAX_USER_UPLOAD_FILE_BYTES } from "../../lib/user-uploads/constants";
import { extractUserUploads, withUserUploads } from "../lib/user-uploads";

export default eveChannel({
  auth: [
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
    // Accept the signed, HTTP-only cookie created by the app's password gate.
    singleUserPasswordAuth(),
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
  ],
  async onMessage(context, message) {
    const uploads = await extractUserUploads(message);
    return { auth: withUserUploads(defaultEveAuth(context), uploads) };
  },
  uploadPolicy: {
    allowedMediaTypes: "*",
    maxBytes: MAX_USER_UPLOAD_FILE_BYTES,
  },
});
