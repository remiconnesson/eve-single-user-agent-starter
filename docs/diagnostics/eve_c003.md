# EVE_C003: Local Gateway credentials missing

The local app cannot find a Vercel OIDC token for AI Gateway.

## Fix

Run:

```bash
vercel link
vercel env pull .env.local
pnpm dev
```

Vercel supplies and refreshes OIDC credentials automatically after deployment.
