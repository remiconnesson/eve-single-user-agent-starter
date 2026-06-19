# EVE_R002: Sandbox file upload failed

The browser could not send a selected file to the current Eve sandbox.

## Fix

Choose one file no larger than 3 MiB and retry the upload. If the same file still fails, find `EVE_R002` in the browser console or Vercel project logs.

Files are sent directly to the Eve session. This starter does not use external file storage.
