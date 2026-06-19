# eve starter template

The smallest useful eve web starter: one agent, one Next.js page, and AI Elements for streamed messages, reasoning, tools, approvals, and sandbox commands. Markdown is rendered with Streamdown through AI Elements' `MessageResponse`.

## Run it

Requires Node.js 24 and an `AI_GATEWAY_API_KEY`. The starter passes this key directly to the Gateway provider and does not fall back to Vercel OIDC.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The agent lives in `agent/`. The web chat uses `useEveAgent()` and same-origin Eve routes configured by `withEve()`.
