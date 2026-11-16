# Data model

All tables are SQLite STRICT; schema_version is managed with PRAGMA user_version=1.
Migration creates tables in one transaction and refuses a newer unsupported schema.
Text is trimmed in Domain. Length limits count Unicode code points after trim. All text must
be well-formed Unicode without NUL or unpaired UTF-16 surrogates; reject rather than silently
replacing characters during the SQLite UTF-8 binding (Converge F1 / Implement T023).

## users
`id TEXT PRIMARY KEY`, `active INTEGER NOT NULL CHECK IN (0,1)`,
`requester INTEGER NOT NULL CHECK IN (0,1)`, `reviewer INTEGER NOT NULL CHECK IN (0,1)`.
Role flags implement the two-role set, including both and neither. IDs are stable local names.
No hard delete path. Operator changes flags transactionally using the same database file.

## tokens
`digest TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id)`,
`revoked INTEGER NOT NULL CHECK IN (0,1)`.
Digest is SHA-256 of a freshly generated 32-byte base64url bearer credential. No plaintext
credential persists. The seed command returns credentials once and refuses a nonempty users table.

## change_requests
| Field | Type / constraint | Purpose |
|---|---|---|
| id | TEXT PK, server UUID | Stable identity |
| title | TEXT NOT NULL, 1–200 code points after trim | Short change name |
| description | TEXT NOT NULL, 1–10000 code points after trim | Proposed change |
| reason | TEXT NOT NULL, 1–2000 code points after trim | Motivation |
| requester_id | TEXT NOT NULL FK users | Immutable creator |
| status | TEXT enum Draft/PendingReview/ChangesRequested/Approved | Workflow |
| version | INTEGER NOT NULL >=1 | CAS token; starts 1; increments on all accepted mutations |
| created_at / updated_at | TEXT NOT NULL ISO UTC | Ordering/observation |
| feedback | nullable TEXT, 1–2000 code points after trim when set | Most recent return reason |
| feedback_by / feedback_at | nullable FK users / ISO UTC | Latest returning reviewer/time |
| approved_by / approved_at | nullable FK users / ISO UTC | Approver/time |
| approved_version | nullable INTEGER >=1 | Version reviewed, before approval increment |

Approval fields are all null until Approved; after approval they are all populated and
approved_by != requester_id. Last feedback fields are populated together and preserved on
resubmit/approval. No review-history table: only latest feedback and final approval are required.
Indexes: (requester_id, created_at, id), (status, created_at, id). Stable ascending list order:
created_at then id. API uses camelCase names. Raw SQL fields never become caller-controlled updates.

## Transitions and actor rules
| Action | From | To | Actor |
|---|---|---|---|
| create | none | Draft | active Requester |
| edit | Draft / ChangesRequested | unchanged | owner + current Requester |
| submit | Draft / ChangesRequested | PendingReview | owner + current Requester |
| approve | PendingReview | Approved | current Reviewer, not owner |
| request-changes | PendingReview | ChangesRequested | current Reviewer, not owner, feedback required |

Every update checks positive safe integer expected version and uses an atomic predicate.
Errors do not change version, timestamps or metadata. A no-op edit still consumes a version.
No route writes status directly. No delete or post-approval edit is supported.
