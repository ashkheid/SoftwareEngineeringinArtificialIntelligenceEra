# Requirement -> implementation -> evidence

Paths for code/tests are relative to `Session01/Assignments/ChangeFlow/`.
Test names carry the requirement IDs; full results are in evidence/*-test.txt.

| Requirement | Implementation | Task / evidence |
|---|---|---|
| FR-001 Draft/owner | domain.createDraft, application.create, store.insertRequest | T007–009; workflow creates/persists Draft |
| FR-002 own editable states | domain.applyChange | T008; workflow edits; security ownership |
| FR-003 Submit | domain.applyChange, application.change | T007–009; workflow submit/cycle |
| FR-004 independent approval | domain review branch | T010–011; workflow independent approval; security action-role |
| FR-005 return/revise/resubmit | domain feedback + state changes | T010–011; workflow correction cycle |
| FR-006 no self-review | domain actor.id vs requesterId | T010–011; dual-role self-review with full stored-row comparison |
| FR-007 immutable Approved/PendingReview | domain state guards | T008,T010–011; workflow edit/transition rejection |
| FR-008 current identity/authority | store.findActor + transaction, application.actor, domain policy | T004–005,T012–017; security revocation and worker ordering |
| FR-009 visibility/pages | domain.canRead, application.visible/list, store.listRequests | T005,T009,T012; security list/detail/page parity |
| FR-010 expected version/CAS | domain version equality, store UPDATE WHERE version | T004,T008,T015–017; stale edits/actions + HTTP/worker races |
| FR-011 durability/atomicity | SQLite migration, transaction commit/rollback, valid-Unicode text boundary | T004,T015–017,T023; reopen, trigger error, rollback, busy, built demo restart; F1 regression and Persian/emoji round trip |
| FR-012 input integrity | domain.validateFields, HTTP UTF-8 JSON parser | T005,T008,T012,T023; limits/shape/forgery/version tests; malformed Unicode rejected on create/edit/feedback |
| FR-013 repeats | UUID create; required version on mutations | T008,T015; distinct creates + repeated submit |
| FR-014 review metadata | domain approval/feedback fields, SQL mapping/checks | T004,T010–011; workflow persisted metadata and stale approval after revision |
| FR-015 local operator | admin seed/roles/deactivate/revoke | T005,T013–014; actual CLI tests against running API |
| FR-016 errors | errors.FlowError, HTTP mapping, storage translation | T003,T009,T012,T015; security transport/errors, persistence busy/failure |

| Success criterion | Evidence |
|---|---|
| SC-001 six required scenarios | workflow + stale-edit persistence tests, persisted row assertions |
| SC-002 full correction cycle | workflow correction test + built-package demo |
| SC-003 one winner, no partial data | separate worker race, stale SQL CAS, rollback and storage failure tests |
| SC-004 current permissions and visibility | security + actual CLI + revocation worker tests |
| SC-005 traceable and reproducible delivery | this matrix, tasks, init/analyze/review/validation/converge reports, evidence transcripts/hashes |

All 16 story acceptance scenarios map to the corresponding four story test groups above.
Constitution I: architecture tests + source review; II: security/CLI tests; III: persistence tests
and resolved F1/T023; IV: actual evidence and no acceptance claim; V: no external dependencies or out-of-scope UI.
Completeness is assessed against actual behavior, not task checkboxes alone.

Final evidence: 39/39 tests, build and built-package demo passed. The two review axes identified
the same F1 defect; its failing reproduction, correction and passing final run are linked in
[validation.md](validation.md). No unresolved requirement gap remains in the final assessment.
