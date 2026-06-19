# EVE_C001: Access password missing

The deployment does not have `EVE_ACCESS_PASSWORD`.

## Fix

Open the Vercel project, go to **Settings → Environment Variables**, and add a private `EVE_ACCESS_PASSWORD`. Apply it to Production and Preview, then redeploy.

Do not paste the password into a support request or diagnostic report.
