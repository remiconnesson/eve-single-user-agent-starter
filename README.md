# eve single-user agent starter

The smallest useful eve web starter: one agent, one Next.js page, and AI Elements for streamed messages, reasoning, tools, approvals, and sandbox commands. Markdown is rendered with Streamdown through AI Elements' `MessageResponse`.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fremiconnesson%2Feve-single-user-agent-starter&env=EVE_ACCESS_PASSWORD&envDescription=Choose%20a%20private%20password.&envLink=https%3A%2F%2Fgithub.com%2Fremiconnesson%2Feve-single-user-agent-starter%23deploy)

Vercel asks for one private value for Production:

- `EVE_ACCESS_PASSWORD`: a private password used to open the deployed workspace.

Vercel supplies the agent with a short-lived OIDC token for AI Gateway automatically. No AI provider key is required. When deployment finishes, open its production URL and enter the access password. Sign-in lasts until the browser closes, or 30 days when **Remember me** is selected. Changing `EVE_ACCESS_PASSWORD` in the Vercel project invalidates existing sessions immediately.

Local development and Vercel Preview deployments open without the application password. This uses Vercel's `VERCEL_ENV=preview` signal; Vercel Deployment Protection, when enabled, still applies before the app. Preview URLs are otherwise public, so do not use them for sensitive conversations or data.

## Run locally

Requires Node.js 24, pnpm, and the Vercel CLI. Link the project and pull a short-lived OIDC token for local AI Gateway access. No access password is required locally.

```bash
pnpm install
vercel link
vercel env pull .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The agent lives in `agent/`. The web chat uses `useEveAgent()` and same-origin Eve routes configured by `withEve()`.

## Web search

The `web_search` tool works even when the selected model's provider has no native search. It runs [Perplexity Search through AI Gateway](https://vercel.com/docs/ai-gateway/capabilities/web-search), then gives the model structured titles, URLs, snippets, and dates.

Search uses the same Gateway authentication as the agent. It needs no additional API key. Search requests and the small model call that dispatches them are billed through AI Gateway.

## Chat history

Chat history is saved in the current browser. Each record keeps Eve's complete resumable cursor and the completed stream events needed to restore messages, reasoning, tools, and approvals after a reload. Streaming deltas are removed before storage to avoid saving repeated partial text.

The UI depends on the `ChatHistoryStore` interface in [`lib/chat-history/store.ts`](./lib/chat-history/store.ts). The default implementation is [`local-storage.ts`](./lib/chat-history/local-storage.ts). A Neon adapter can implement the same asynchronous `list`, `get`, `upsert`, and `remove` methods without changing the chat UI.

Browser history does not sync across devices or browsers. Deleting a chat removes its browser record; it does not delete the underlying Vercel Workflow run.

## Access protection

This starter includes application-level protection so the production domain can remain private without Vercel's Advanced Deployment Protection. Local development and Vercel Preview bypass this application password:

- The password is checked only on the server and is never included in browser JavaScript.
- Successful login creates a signed, HTTP-only, same-site cookie.
- Next.js verifies the cookie before rendering the page; `proxy.ts` provides the early redirect but is not the only authorization check.
- Eve independently verifies the same cookie in Production before accepting session requests and records every accepted caller as the single `owner` principal.
- `/eve/v1/health` remains public for deployment health checks.

This is intentionally single-user access, not an account system. Use a long, unique password. There is no password recovery flow; update `EVE_ACCESS_PASSWORD` in Vercel if it needs to be replaced.

## Diagnostics and logs

Open **Diagnostics** from the chat header when the app is not working. The page checks the deployment, runtime, access-password configuration, and Gateway authentication mode. **Copy Report** produces a JSON support report that excludes passwords, tokens, cookies, prompts, and model responses.

The app uses [evlog](https://www.evlog.dev/) across its server and browser boundaries:

- one structured event for login, logout, diagnostics, and client-log requests;
- global Next.js render-error capture;
- privacy-safe browser events for submissions and failures;
- one turn-level event from Eve with token counts, tool names, error counts, and content lengths, but no content.

Vercel captures these events in project logs. Filter by `service`, `event`, `requestId`, or a Nostics code such as `EVE_R001`. Stable diagnostic codes and fixes live in [`docs/diagnostics`](./docs/diagnostics).

## Test

```bash
pnpm test
pnpm typecheck
pnpm build
```
