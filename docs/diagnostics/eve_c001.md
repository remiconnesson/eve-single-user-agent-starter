# EVE_C001: Access password missing

The production deployment does not have `EVE_ACCESS_PASSWORD`. Local development and Vercel Preview deployments do not require one.

## Fix

Open the Vercel project, go to **Settings → Environment Variables**, and add a private `EVE_ACCESS_PASSWORD`. Apply it to Production, then redeploy.

Do not paste the password into logs or a support request.
