# Tasks: ChangeFlow

Input: spec.md, plan.md, research.md, data-model.md and contracts/http-api.md.
App-relative paths below mean `Session01/Assignments/ChangeFlow/`.
Tests are explicitly required by Assignment section 6. No source edits occurred during Analyze.

## Phase 1: Setup
- [x] T001 Complete `.specify/memory/constitution.md`, feature spec, assumptions and `checklists/requirements.md` (FR-001–016, SC-005).
- [x] T002 Define `plan.md`, `research.md`, `data-model.md`, `contracts/http-api.md`, `quickstart.md`; run Analyze before code (SC-005).
- [x] T003 Add app `package.json`, `.gitignore` and `src/errors.mjs` without dependencies (FR-016).

## Phase 2: Foundation
- [x] T004 Implement schema version 1/migration/transactions in `src/database.mjs`: STRICT tables, FK, role booleans, version >=1; approval fields all-null or all-set, independent approver; migration precedes consumers (FR-008,010,011,014).
- [x] T005 Implement `src/domain.mjs` validation/visibility and `src/admin.mjs` provisioning/current roles/revocation: title 1–200, description 1–10000, reason/feedback 1–2000 code points after trim; exact fields; positive safe version (FR-008,009,012,015).
- [x] T006 Add real file DB/HTTP fixture and separate persisted-state reader in `tests/helpers/fixture.mjs` (SC-001–004).

## Phase 3: US1 — create/edit/submit (P1, minimum viable slice)
Independent test: Requester creates/reads/edits/submits own Draft and cannot modify another owner.
- [x] T007 [US1] Write and execute initial create/submit tests in `tests/workflow.test.mjs` before implementation (FR-001,003; SC-001).
- [x] T008 [US1] Implement draft/edit/submit policy in `src/domain.mjs`, orchestration in `src/application.mjs`, SQL operations in `src/database.mjs` (FR-001–003,007,010,012,013).
- [x] T009 [US1] Implement transport-only routes/error mapping in `src/http.mjs` and server lifecycle in `src/server.mjs`; run US1 tests (FR-009,016).

## Phase 4: US2 — independent review and revisions (P1)
Independent test: two identities complete approve and feedback/edit/resubmit paths with stored assertions.
- [x] T010 [US2] Add review/self-review/immutable/cycle tests to `tests/workflow.test.mjs` before review policy (FR-004–007,014; SC-001,002).
- [x] T011 [US2] Implement approve/request-changes and review metadata in `src/domain.mjs`; expose actions through `src/http.mjs`; run story tests (FR-004–007,014).

## Phase 5: US3 — current authority and visibility (P1)
Independent test: committed role/token revocation affects next command; users never see other Drafts.
- [x] T012 [US3] Add role, visibility, identity, forged fields and invalid transport tests in `tests/security.test.mjs` (FR-008,009,012,016; SC-004).
- [x] T013 [US3] Complete trusted CLI commands in `src/admin.mjs`, add operational tests in `tests/cli.test.mjs`; validate missing/unknown arguments (FR-015).
- [x] T014 [US3] Run security/CLI tests; fix confirmed gaps only in `src/domain.mjs`, `src/application.mjs`, `src/http.mjs`, `src/admin.mjs` (FR-008,009,012,015,016).

## Phase 6: US4 — concurrency and durability (P1)
Independent test: distinct writer connections race; fresh persisted read proves one winner and no partial state.
- [x] T015 [US4] Add stale-command, reopen, SQL failure/rollback and busy-lock tests to `tests/persistence.test.mjs` (FR-010,011,013,016; SC-001,003).
- [x] T016 [US4] Add barrier-driven competing writer tests and role-revocation ordering in `tests/helpers/race-worker.mjs` and `tests/persistence.test.mjs` (FR-008,010,011; SC-003,004).
- [x] T017 [US4] Execute persistence tests; correct confirmed transaction/CAS gaps in `src/database.mjs` and `src/application.mjs` (FR-008,010,011).

## Phase 7: Evidence and delivery
- [x] T018 [P] Add import-boundary checks to `tests/architecture.test.mjs` and inspect source policy placement (Constitution I, SC-005).
- [x] T019 [P] Add `scripts/build.mjs` and built-package HTTP `scripts/demo.mjs` (SC-001,002,005).
- [x] T020 Write app `README.md` and `docs/answers/session-01.md`, linking the five original HTML analyses, stack, limitations and actual repository URL (SC-005).
- [x] T021 Execute full tests, build and built-package demo; capture real outputs in app `evidence/`; write `reports/validation.md` and `reports/traceability.md` (SC-001–005).
- [x] T022 Run read-only Converge assessment; append only actionable new tasks to this file; archive findings separately in `reports/converge.md` and implement any appended tasks (SC-005).

## Dependencies & execution order
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008 -> T009 ->
T010 -> T011 -> T012 -> T013 -> T014 -> T015 -> T016 -> T017 ->
(T018, T019) -> T020 -> T021 -> T022.
US1 precedes US2 because review needs submitted requests. US3/US4 use completed flows to verify
their security/atomicity. They are independently observable tests, not independent deployments.
T018/T019 are the only parallel-safe tasks: different files after all stories. US1/US2 share
domain/application/http/workflow files; no [P] labels. US3/US4 also run serially on their shared files.

## Implementation strategy
Contracts -> foundational transactions -> each tested story -> evidence -> convergence. Tests are
added before each behavioral slice; already shared behavior may pass immediately. Do not fabricate
red runs. Completion checkboxes reflect implemented work, not human acceptance. No commit/push step.

## Phase 8: Convergence
- [x] T023 CRITICAL Reject unpaired UTF-16 surrogates before persistence in `src/domain.mjs`; first reproduce the accepted-response/stored-content mismatch in `tests/security.test.mjs`, then cover create/edit/feedback rejection and valid Persian/emoji round trips; clarify the valid-Unicode input contract in `spec.md`, `data-model.md`, `contracts/http-api.md`; rerun build/tests/demo into app `evidence/` and update validation/traceability reports per Constitution III, FR-011, FR-012, SC-005 (contradicts; F1).
