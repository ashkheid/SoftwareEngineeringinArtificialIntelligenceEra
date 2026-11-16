# HTTP API contract v1

Base: `http://127.0.0.1:3000`. All routes require `Authorization: Bearer <issued-token>`.
All bodies and responses use JSON; send `Content-Type: application/json` for writes.
UTF-8 request bodies <=65536 bytes. No CORS, cookies or client-selected identity headers.
Trailing slashes, unknown paths/query fields and unsupported methods are not aliases.

## Routes
| Method/path | Input | Success |
|---|---|---|
| POST /requests | title, description, reason | 201 ChangeRequest + Location header |
| GET /requests | optional limit=1..100 (default 20), offset=0..1000000 (default 0) | 200 {items,limit,offset} |
| GET /requests/{id} | server-generated UUID | 200 ChangeRequest |
| PUT /requests/{id} | title, description, reason, version | 200 ChangeRequest |
| POST /requests/{id}/submit | version | 200 ChangeRequest |
| POST /requests/{id}/approve | version | 200 ChangeRequest |
| POST /requests/{id}/request-changes | version, feedback | 200 ChangeRequest |

`version` is a positive JavaScript-safe integer <=9007199254740990; every accepted mutation
increments it once. Body shapes are exact: unknown or missing fields fail. String limits and
visibility follow spec A2/A7. Text must be well-formed Unicode: NUL and escaped unpaired UTF-16
surrogates are InvalidInput/400; valid Persian, emoji and paired surrogates are preserved after trim.
Query keys must occur once. Other routes accept no query parameters.
GET bodies are not consumed. Supported resource path with wrong method returns 405 + Allow.

## ChangeRequest representation
```json
{
  "id": "a0000000-0000-4000-8000-000000000001",
  "title": "Add an export endpoint",
  "description": "Allow exporting approved changes as CSV.",
  "reason": "Reduce manual reporting.",
  "requesterId": "alice",
  "status": "Approved",
  "version": 3,
  "createdAt": "2026-11-16T10:00:00.000Z",
  "updatedAt": "2026-11-16T10:02:00.000Z",
  "feedback": null,
  "feedbackBy": null,
  "feedbackAt": null,
  "approvedBy": "bob",
  "approvedAt": "2026-11-16T10:02:00.000Z",
  "approvedVersion": 2
}
```
The approval reviewed version 2 and produces version 3. Approved content cannot change.
Feedback describes the latest return, not all historic decisions. Lists use the same representation.

## Errors
Envelope: `{"error":{"code":"VersionConflict","message":"..."}}`.
Clients rely on `code`, not English message text. Sensitive data is never included in errors.

| HTTP | Codes | Meaning |
|---|---|---|
| 400 | InvalidInput, InvalidJson, InvalidQuery | malformed/unknown/missing fields, invalid id/version/text/query |
| 401 | Unauthenticated | missing/malformed/unknown/revoked token or inactive user; WWW-Authenticate: Bearer |
| 403 | Forbidden, SelfReview | missing current role, non-owner modification or self review |
| 404 | NotFound | unknown or invisible request; unknown route |
| 405 | MethodNotAllowed | known route, unsupported method; Allow header |
| 409 | VersionConflict, InvalidState | stale version or invalid transition/edit |
| 413 | PayloadTooLarge | body exceeds limit |
| 415 | UnsupportedMediaType | write without application/json |
| 503 | StorageBusy, StorageFailure | lock timeout or storage failure; Retry-After: 1 |
| 500 | InternalError | unexpected implementation failure, no internal details |

For well-formed commands: identity -> visibility -> role/ownership -> version -> state -> write.
Input errors can be found before policy checks; clients must not depend on error precedence for
requests with several independent faults. Domain/Application produce symbolic errors only.
An invisible request is 404, even when an attempted mutation would also be unauthorized.

## Repetition and concurrency
POST /requests repeats create separate UUIDs (no idempotency key). Subsequent commands require the
returned version. Repeating the same command/version returns 409 without mutation. On conflict,
GET current state and decide again; do not automatically approve a newer unseen version.
Committed role/token revocation is observed by the next operation. Racing commands and operator
changes serialize on the same SQLite file; wall-clock request arrival is not the commit order.

## Trusted local CLI (not HTTP)
From the app directory: `node src/admin.mjs init-demo`, `set-roles <id> Requester,Reviewer`,
`set-roles <id> none`, `deactivate <id>`, `revoke-tokens <id>`.
`CHANGEFLOW_DB` chooses the file (default `data/changeflow.sqlite`). Operator has filesystem-level
authority. init-demo refuses an existing user population and never restores revoked roles/tokens.
