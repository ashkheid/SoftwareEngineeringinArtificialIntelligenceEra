# Implementation Plan: ChangeFlow

**Feature**: `001-changeflow` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

## Summary
One local, durable HTTP service for the four-state workflow. Policy belongs to Domain,
transaction orchestration to Application, SQL to Infrastructure and protocol handling to HTTP.
Use installed Node.js and built-in SQLite, with no npm dependencies.

## Technical Context
- Language: JavaScript ESM; target installed Node.js 22.23.4; minimum 22.16.
- Dependencies: Node built-ins http, crypto, sqlite, fs, path, test, worker_threads.
- Storage: file SQLite, WAL, foreign keys, STRICT tables, schema version 1, busy timeout 5000 ms.
- Testing: node:test, real HTTP, fresh file DB per test, separate-connection persisted assertions,
  worker threads with separate connections and start barrier for genuine database races.
- Platform: local Windows executed here; portable source, other operating systems not claimed tested.
- Scope: small local assignment, one organization, two roles; no throughput/SLA or public deployment.
- Limits: body <=64 KiB, list <=100 rows; synchronous short transactions without network awaits.

## Constitution Check
Pre-research and post-design: I–V pass, with no exceptions.
I: Domain does not import HTTP/SQL; HTTP never decides ownership, state or approval.
II: current authority comes from the same database transaction as the mutation.
III: BEGIN IMMEDIATE + version predicate + commit-before-success; failures roll back.
IV: traceability, six mandatory tests, source review and real transcripts; no invented acceptance.
V: one service, no ORM/framework/DI container/history engine; concrete storage adapter only.

## Project Structure
```text
.specify/memory/constitution.md
specs/001-changeflow/
  spec.md plan.md research.md data-model.md quickstart.md tasks.md
  contracts/http-api.md
  checklists/requirements.md
  reports/{init,analyze,validation,converge,traceability}.md
Session01/Assignments/ChangeFlow/
  package.json .gitignore README.md
  src/{errors,domain,database,application,http,server,admin}.mjs
  scripts/{build,demo,validate}.mjs
  tests/{workflow,security,persistence,architecture,cli}.test.mjs
  tests/helpers/{fixture,race-worker}.mjs
  docs/answers/session-01.md
  evidence/
```

## Phases and responsibilities
1. Contracts/spec/assumptions/data model/tasks, then read-only Analyze.
2. Foundation: error vocabulary, domain validation, transactional migration/store, token lookup
   and trusted local provisioning. Migration precedes SQL consumers.
3. US1: tests for create/edit/submit, then Domain -> Application -> HTTP and executable server.
4. US2: tests for independent review, feedback, revision/resubmit and immutable approved state;
   then implement policy and expose actions through existing generic HTTP dispatch.
5. US3: tests/current-role revocation, visibility, malformed input and trusted CLI operations.
6. US4: stale versions, real writer races, rollback/busy/reopen evidence.
7. Build, built-package demo, README, source review, reports and Converge loop.
Shared files imply serial tasks. Tests for each slice precede its implementation; later scenarios
may already pass because foundational mechanisms are shared, which must be reported honestly.

## Public module contracts
- `FlowError(code,message)`: semantic error, no HTTP status.
- Domain: `validateFields(input,kind)`, `canRead(actor,request)`,
  `createDraft(actor,input,id,now)`, `applyChange(actor,request,action,input,now)`.
  Pure policy functions return new plain objects or throw FlowError.
- Store: `openStore(filename,{timeout=5000}={})`; `transaction(work,write=true)`,
  `findActor(token)`, `getRequest(id)`, `listRequests(actor,limit,offset)`,
  `insertRequest(request)`, `updateRequest(request,expectedVersion)`, `close()`.
  Transactions accept synchronous callbacks only and roll back on exceptions.
- Application: `new ChangeFlow(store)` with `create(token,input)`, `get(token,id)`,
  `list(token,query)`, `change(token,id,action,input)`. Authenticate within each transaction.
- HTTP: `createApi(service,{onError}={})` returns an unbound Node server; decode HTTP,
  enforce body/content-type limits, invoke service, map symbolic errors to HTTP.
- Admin: `seedDemo(store)`, `setRoles(store,id,roles)`, `deactivate(store,id)`,
  `revokeTokens(store,id)`. Local filesystem authority only; no public HTTP routes.

## Atomicity and error design
BEGIN IMMEDIATE precedes identity/role/state reads. Apply ownership/role rules, compare supplied
version and state, then UPDATE WHERE id=? AND version=?; exactly one affected row is required.
Read transactions provide a consistent actor/visibility snapshot. All operator writes use the same
database lock. No await or network side effect inside the transaction. Commit precedes response.
SQLite busy/locked becomes StorageBusy/503; other SQL failures StorageFailure/503; unexpected
programming errors InternalError/500. No details or credentials reach client errors.
Clients must reread after conflict and make a new decision, never automatically approve new content.
The local admin infrastructure uses Store.db inside Store.transaction for provisioning SQL;
Application does not access the raw handle. The list query compiles the same visibility predicate
as Domain.canRead so pagination happens after filtering; parity tests cover both paths. These
small concrete seams avoid a general query/repository abstraction for two roles.

## Validation
HTTP integration is the main boundary; sensitive assertions also inspect a fresh DB connection
as the assignment requires. Architecture import tests are supplemented by source inspection of
policy placement. Build syntax-checks sources and assembles dist/src plus package.json; there is
no compilation/transpilation. Run a real HTTP demo against the built package. Record actual
counts/failures and preserve the distinction between technical completion and human acceptance.

## Complexity Tracking
No constitution exceptions. Experimental node:sqlite and synchronous throughput limits are
documented trade-offs. Future storage or identity replacement must preserve Domain invariants.
