# EVE_C002: Access password too short

`EVE_ACCESS_PASSWORD` has fewer than 16 characters.

## Fix

Replace it in **Vercel → Settings → Environment Variables** with a longer unique password, then redeploy. Changing the value signs out existing sessions.
