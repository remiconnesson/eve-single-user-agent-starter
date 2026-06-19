# eve single-user agent starter

The smallest useful eve web starter: one agent, one Next.js page, and AI Elements for streamed messages, reasoning, tools, approvals, and sandbox commands. Markdown is rendered with Streamdown through AI Elements' `MessageResponse`.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fremiconnesson%2Feve-single-user-agent-starter&env=EVE_ACCESS_PASSWORD&envDescription=Choose%20a%20private%20password%20of%20at%20least%2016%20characters.&envLink=https%3A%2F%2Fgithub.com%2Fremiconnesson%2Feve-single-user-agent-starter%23deploy)

Vercel asks for one private value during deployment:

- `EVE_ACCESS_PASSWORD`: a unique password of at least 16 characters used to open the deployed workspace.

Vercel supplies the agent with a short-lived OIDC token for AI Gateway automatically. No AI provider key is required. When deployment finishes, open its production URL and enter the access password. The browser remains signed in for 30 days. Changing `EVE_ACCESS_PASSWORD` in the Vercel project invalidates existing sessions immediately.

## Run locally

Requires Node.js 24, pnpm, the Vercel CLI, and an `EVE_ACCESS_PASSWORD`. Link the project and pull a short-lived OIDC token for local AI Gateway access.

```bash
pnpm install
vercel link
vercel env pull .env.local
# Add EVE_ACCESS_PASSWORD if it is not already present.
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The agent lives in `agent/`. The web chat uses `useEveAgent()` and same-origin Eve routes configured by `withEve()`.

## Access protection

This starter includes application-level protection so the production domain can remain private without Vercel's Advanced Deployment Protection:

- The password is checked only on the server and is never included in browser JavaScript.
- Successful login creates a signed, HTTP-only, same-site cookie.
- Next.js verifies the cookie before rendering the page; `proxy.ts` provides the early redirect but is not the only authorization check.
- Eve independently verifies the same cookie before accepting session requests and records the caller as the single `owner` principal.
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
