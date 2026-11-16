# Quickstart validation

Prerequisite: Node.js >=22.16 (tested version 22.23.4). No dependency installation required.
Run commands in `Session01/Assignments/ChangeFlow`.

```powershell
node --version
npm.cmd run build
npm.cmd test
npm.cmd run demo
```
Build syntax-checks runnable modules and assembles dist. Tests use temporary isolated DBs.
Demo starts a built-package server on an ephemeral loopback port, drives HTTP create -> edit ->
submit -> request-changes -> edit -> resubmit -> approve, verifies immutable/stale failures,
then closes and cleans its own temporary data. It does not expose credentials in the transcript.

For persistent manual use:
```powershell
node src/admin.mjs init-demo
node src/server.mjs
```
Save the generated bearer credentials from init-demo securely. It refuses to reseed an existing
user population. Set CHANGEFLOW_DB for a different file; PORT defaults to 3000 and HOST to 127.0.0.1.
Use the HTTP examples in the application README and [contract](contracts/http-api.md).

Verify the six assignment scenarios: create Draft; submit PendingReview; self-approval rejection
with a dual-role user; independent approval; Approved edit rejection; stale-version rejection.
Sensitive failures must leave persisted state/version/metadata unchanged. Read actual executed
results in reports/validation.md; this guide alone is not evidence of execution.
