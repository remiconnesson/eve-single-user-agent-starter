# eve starter template

The smallest useful eve web starter: one agent, one Next.js page, and AI Elements for streamed messages, reasoning, tools, approvals, and sandbox commands. Markdown is rendered with Streamdown through AI Elements' `MessageResponse`.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fremiconnesson%2Feve-starter-template&env=AI_GATEWAY_API_KEY,EVE_ACCESS_PASSWORD&envDescription=Add%20your%20Vercel%20AI%20Gateway%20API%20key%20and%20a%20private%20password%20of%20at%20least%2016%20characters.&envLink=https%3A%2F%2Fgithub.com%2Fremiconnesson%2Feve-starter-template%23deploy)

Vercel asks for two private values during deployment:

- `AI_GATEWAY_API_KEY`: an [AI Gateway API key](https://vercel.com/docs/ai-gateway/authentication#api-key) used by the agent.
- `EVE_ACCESS_PASSWORD`: a unique password of at least 16 characters used to open the deployed workspace.

When deployment finishes, open its production URL and enter the access password. The browser remains signed in for 30 days. Changing `EVE_ACCESS_PASSWORD` in the Vercel project invalidates existing sessions immediately.

## Run locally

Requires Node.js 24, pnpm, an `AI_GATEWAY_API_KEY`, and an `EVE_ACCESS_PASSWORD`. The starter passes the API key directly to the Gateway provider and does not fall back to Vercel OIDC.

```bash
pnpm install
cp .env.example .env.local
# Add both values to .env.local.
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

## Test

```bash
pnpm test
pnpm typecheck
pnpm build
```
