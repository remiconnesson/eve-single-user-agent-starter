import { eveChannel } from "eve/channels/eve";
import { localDev, placeholderAuth, vercelOidc } from "eve/channels/auth";
import { singleUserPasswordAuth } from "../../lib/auth/eve";
import { MAX_SANDBOX_FILE_BYTES } from "../lib/sandbox-files";

export default eveChannel({
  auth: [
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
    // Accept the signed, HTTP-only cookie created by the app's password gate.
    singleUserPasswordAuth(),
    // Lets the Eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Keep failing closed when no configured authenticator accepts the request.
    placeholderAuth(),
  ],
  uploadPolicy: {
    allowedMediaTypes: "*",
    maxBytes: MAX_SANDBOX_FILE_BYTES,
  },
});
