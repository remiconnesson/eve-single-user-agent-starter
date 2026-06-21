# eve single-user agent starter

This repository is a beginner-facing adoption starter for eve. Protect the short path from deployment to a successful first conversation. Keep the README focused on that path and put implementation detail here.

## Read before editing

This project uses the eve framework. Before writing code, read the relevant guide in `node_modules/eve/docs/`. Treat the installed package and the current codebase as the source of truth.

The canonical eve web-chat scaffold lives at `../eve/apps/templates/web-chat-next` when the eve repository is available beside this checkout. Preserve AI Elements for chat and tool rendering, and preserve Streamdown through AI Elements' `MessageResponse`.

## Verify changes

Run the checks that cover the changed behavior. Before publishing a broad change, run all three:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Use `pnpm exec eve info --json` to verify agent discovery, tools, channels, and diagnostics. When browser behavior changes, test the real flow in a browser.

## Project map

- `agent/agent.ts` selects the model.
- `agent/instructions.md` defines the agent's always-on behavior.
- `agent/tools/` contains authored tools for web search, image generation, and file downloads.
- `agent/channels/eve.ts` configures the same-origin eve channel, authentication, and upload policy.
- `app/_components/` contains the chat, message, history, and upload interfaces.
- `lib/auth/` contains the production password gate.
- `lib/chat-history/` contains browser history persistence.
- `lib/sandbox-files/` contains the shared browser and agent artifact contract.
- `docs/diagnostics/` contains stable diagnostic codes and recovery guidance.

## Deployment and authentication

Production requires `EVE_ACCESS_PASSWORD`. The app validates the password on the server and creates a signed, HTTP-only, same-site cookie. Next.js protects the page, and the eve channel independently protects session routes with the same cookie.

Local development and Vercel Preview use their environment identity instead of the application password. Preview deployments may be public when Vercel Deployment Protection is disabled. Do not change this behavior without updating the README and the auth tests.

Vercel supplies a short-lived OIDC token for AI Gateway. The starter must not require a provider API key for its default Vercel deployment path.

## Agent and interface behavior

- The app is intentionally single-user. Do not turn the password gate into a multi-user account system without an explicit product decision.
- Keep tool calls, tool results, reasoning, approvals, and sandbox activity in the AI Elements message flow.
- Keep Markdown rendering in AI Elements' `MessageResponse`, which uses Streamdown.
- The stop button remains behind `EVE_ENABLE_STOP_BUTTON=1`. Client abort stops the active request or stream but does not cancel the durable eve workflow.
- `MAX_STREAM_RECONNECT_ATTEMPTS` is a temporary client-side allowance for Vercel stream rotation while `vercel/eve#134` remains unresolved. Do not make the retry budget infinite.

## Uploaded files and generated artifacts

The browser queues up to five files. Each file can be 1 MiB, and one submission can contain 3 MiB. Files travel with the next text prompt so one batch produces one eve turn.

The agent synchronizes uploads into the sandbox:

- `/workspace/user_uploads/originals/` stores immutable, content-addressed originals.
- `/workspace/user_uploads/copies/` stores writable copies only when a task needs to modify a file.
- `/workspace/user_uploads/manifest.json` records the stable paths for the session.

For read-only work, use the immutable original. Do not probe a writable copy that has not been created, and do not prefer eve's transient `/workspace/attachments/` path after synchronization.

`generate_image` saves images under `/workspace/generated`. `download_file` returns validated files up to 3 MiB. PNG, JPEG, and WebP artifacts render inline; other media types stay download-only. Browser history removes inline bytes, so a reloaded chat may need the agent to prepare the file again.

The Vercel sandbox stream adapter in `agent/lib/sandbox-files.ts` is temporary. Remove it after the installed eve release includes `vercel/eve#117`, then re-run the production create-and-download flow.

## Chat history

Chat history uses the `ChatHistoryStore` interface and defaults to `localStorage`. Records include the resumable eve session cursor and completed events needed to restore the conversation. Streaming deltas and inline file bytes are removed before storage.

Browser history does not sync across devices. Deleting a browser record does not delete its underlying Vercel Workflow run. Keep this limitation visible in the README.

## Diagnostics and privacy

The app uses evlog at server and browser boundaries. Logs may include event names, diagnostic codes, request IDs, tool names, token counts, error counts, and content lengths. Do not log prompts, responses, uploaded file contents, credentials, or raw browser error text.

Diagnostics are log-only. Stable codes and recovery steps live in `docs/diagnostics/`. Preserve the code when changing an error path so operators can continue searching logs and documentation.

## README contract

Write the README for someone deploying their first agent. Lead with the outcome and the deploy button. Keep the required password, Preview privacy warning, first prompts, first customization, local setup, beta status, and links to eve documentation accurate.

Move architecture, invariants, compatibility workarounds, and maintenance commands here instead of expanding the beginner path. Avoid claims that the starter is production-ready while eve and key dependencies remain in beta.
