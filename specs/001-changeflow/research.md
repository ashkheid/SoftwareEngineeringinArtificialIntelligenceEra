# Research — ChangeFlow

Date: 2026-11-16. Decisions are scoped to the installed runtime and the local assignment.
Research used the existing checkout, installed Node version and primary sources; no tooling installed.

## R1 — Runtime and application shape
**Decision:** JavaScript ESM on Node.js 22.23.4, one HTTP service, no npm dependencies.
**Reason:** Node is available; dotnet/Python/Java were not selected or installed. Native http,
test and sqlite provide the required behaviors without framework setup. Modules separate
policy, transactions, SQL and transport without separate deployables.
**Alternatives:** .NET matches course samples but its CLI is absent from PATH; Express adds
a dependency for a small route set; microservices add distributed correctness concerns.

## R2 — Persistence
**Decision:** file SQLite, WAL, foreign_keys=ON, STRICT tables, transactional schema version 1.
**Reason:** durable storage with real transactions, shared across connections, easy local execution.
**Alternatives:** in-memory loses restart durability; JSON files require rebuilding locking and
atomic-write semantics; PostgreSQL is appropriate at larger scale but adds a separate service.
**Trade-off:** one writer at a time and synchronous calls block a Node event loop while waiting.
Use short transactions and a 5000 ms busy timeout. No production capacity claim.

## R3 — Credential and current authority
**Decision:** random 256-bit bearer tokens provisioned by trusted local CLI; only SHA-256 token
digests are stored. Tokens identify users, never embed authoritative roles. Every use case reads
active flag, token revocation and current role flags from the same DB transaction as the action.
**Alternatives:** client-selected user/role headers permit impersonation; self-contained JWT role
claims need an additional freshness/revocation design; OIDC is unnecessary for this local exercise.
**Trade-off:** no login, password recovery, expiry or external identity provider. Tokens require
manual revocation; local database/CLI access is trusted. Production needs TLS and managed identity.
Do not log bearer values; demo credentials are generated, never hard-coded into repository files.

## R4 — Concurrency and revocation ordering
**Decision:** all changes require a positive integer expected version. BEGIN IMMEDIATE precedes
identity/role/request reads; UPDATE uses id + expected version and increments once. A committed
revocation is observed by the next mutation; competing revocation and action serialize.
**Reason:** this closes the authorization/read/write gap, including across worker connections.
SQLite allows only one writer and IMMEDIATE obtains the write transaction before reading.
**Alternatives:** version comparison only in JavaScript can lose updates across processes; a
process mutex cannot protect another process; timestamp versions risk resolution collisions.
**Trade-off:** busy contention is 503, stale version is 409. Caller rereads, rather than blind retry.
This ordering is a design inference from [SQLite transactions](https://www.sqlite.org/lang_transaction.html)
and [SQLite isolation](https://www.sqlite.org/isolation.html), verified with local concurrency tests.

## R5 — Approval/content integrity
**Decision:** freeze PendingReview and Approved content; store approver, approvedAt and the
reviewed version. No execution endpoint exists. Version represents every mutation, not only content.
**Alternatives from question 3:** snapshots retain exact history but duplicate data; canonical
hashes detect equality but not authority/differences; immutable revision entities improve audit but
add lifecycle/query complexity. This release forbids post-approval editing, so a separate
ContentRevision/history subsystem is not required. Future execution/revision features need a new spec.

## R6 — Verified library contracts
The exact release [SQLite API](https://raw.githubusercontent.com/nodejs/node/v22.23.4/doc/api/sqlite.md)
and [native implementation](https://raw.githubusercontent.com/nodejs/node/v22.23.4/src/node_sqlite.cc)
confirm DatabaseSync(path,{timeout}), exec, prepare, get/all/run and boolean isTransaction.
run returns changes/lastInsertRowid; get may return undefined; rows have null prototypes.
Bindings accept null/strings/numbers, not undefined/booleans/Date objects. SQLite exceptions use
ERR_SQLITE_ERROR with numeric errcode; primary code 5/6 means busy/locked. Use positional bindings.
node:sqlite is experimental in Node 22; record its warning rather than suppressing it.
The [worker API](https://raw.githubusercontent.com/nodejs/node/v22.23.4/doc/api/worker_threads.md)
supports separate execution threads and a SharedArrayBuffer start barrier. Promise.all on a single
synchronous store would not establish independent database writers.

## R7 — Build and evidence
**Decision:** built-in node:test; actual HTTP and real file DB; syntax-check and copy source to dist.
**Reason:** no transpilation is needed. A built-package demo proves that the delivered layout runs.
Sensitive tests read persisted state through a new SQLite connection. Architecture checks inspect
imports; source review separately assesses the meaning/location of policy. Human acceptance stays open.

## HTML guidance applied
1. Question 1: transport-independent policy and architecture review, Constitution I.
2. Question 2: assumptions A1–A8 explicitly recorded; current roles and visibility are distinct.
3. Question 3: business guarantee differs from ContentRevision; R5 compares alternatives.
4. Question 4: migration before consumers; no parallel labels for shared-file tasks.
5. Question 5: real Build/Test != Acceptance; Converge emits tasks and Implement fixes them.
