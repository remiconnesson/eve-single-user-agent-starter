# EVE_R002: Sandbox file upload failed

The browser could not send a selected file to the current eve sandbox.

## Fix

Choose no more than five files, keep each file at 1 MiB or less, and keep the batch at 3 MiB or less. Retry with a text prompt. If the same files still fail, find `EVE_R002` in the browser console or Vercel project logs.

Files are sent directly to the eve session. This starter does not use external file storage.
