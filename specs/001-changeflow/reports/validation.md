# Build / Test / Validation — actual evidence

## Environment and authorization
The user requested the full assignment and a review loop; the assignment explicitly requires
Build/Test/Validation. Runtime: Node 22.23.4, bundled SQLite 3.53.4, Windows x64. No dependencies
installed. Authoritative timestamps and source SHA-256 hashes are in each evidence summary.

## Executed implementation iterations
| Stage | Actual result |
|---|---|
| Initial default node --test launch | Failed before tests: child-process spawn EPERM in sandbox |
| Same-process initial workflow tests | 2 tests, 0 pass, 2 fail before create/submit implementation |
| Create/edit/submit implementation | 2 tests, 2 pass |
| Review tests added before review policy | 8 tests, 3 pass, 5 fail |
| Workflow + security implementation | 18 tests, 18 pass |
| Architecture + persistence | 16 tests, 15 pass, 1 teardown failure: Windows ENOTEMPTY on temp cleanup |
| Cleanup retry + actual CLI/persistence run | 16 tests, 16 pass |
| Complete initial validation | Build pass; 37 tests, 37 pass; built-package HTTP demo pass |
| F1 regression before correction | 2 tests, 1 pass, 1 fail; confirmed successful response differed from persisted Unicode text |
| Complete final validation | Build pass; 39 tests, 39 pass; built-package HTTP demo pass; 0 failed/skipped/cancelled/todo |

The early results above are the actual session command outputs, summarized here; they are not
retroactively generated raw transcripts. The full initial validation is preserved verbatim in
`Session01/Assignments/ChangeFlow/evidence/initial-{build,test,demo}.txt` and initial-summary.json.
Tests use same-process node:test to avoid its default subprocess-isolation restriction; actual CLI
and build checks require child processes and ran with scoped sandbox escalation, which was granted.

## Reproduce
From `Session01/Assignments/ChangeFlow`:
```powershell
node scripts/validate.mjs final
```
The script runs `node scripts/build.mjs`, the five node:test files with the TAP reporter, then
`node scripts/demo.mjs`. It records stdout/stderr, exit codes, counts, runtime and source hashes.
It stops on a failed command; a missing later command is not reported as passed.

## What the evidence establishes
- Six mandatory scenarios are covered through HTTP, including independent persisted-state reads.
- Additional coverage includes correction cycles, current role/token revocation, active identity,
  visibility, forged input, malformed transport, repeated commands and metadata preservation.
- Real SQLite errors and busy locks return failure without partial data; explicit rollback is tested.
- Separate worker connections race on a real file. One wins and one gets VersionConflict.
- Role revocation ordering is checked before worker execution and against a held write transaction.
- Built-package demo closes all connections, starts a fresh API and reads the unchanged approved request.
- Import-boundary checks supplement the separate source review in review.md.

## Review correction and final result
37 passing tests did not prove completeness: source review found F1, a Unicode input/storage
consistency gap. It is tracked through Converge/Implement rather than hidden by the initial pass.
The failing reproduction is preserved in [unicode-red-stdout.txt](../../../Session01/Assignments/ChangeFlow/evidence/unicode-red-stdout.txt)
and [unicode-red-stderr.txt](../../../Session01/Assignments/ChangeFlow/evidence/unicode-red-stderr.txt).
After the shared validator rejected unpaired surrogates, the complete final run succeeded at
`2026-11-16T13:53:53.621Z` on Node v22.23.4 / SQLite 3.53.4 / Windows x64:

| Check | Exit code | Raw evidence |
|---|---|---|
| Build: syntax check 7 runtime modules and assemble dist | 0 | [final-build.txt](../../../Session01/Assignments/ChangeFlow/evidence/final-build.txt) |
| Test: all 39 pass, no skips | 0 | [final-test.txt](../../../Session01/Assignments/ChangeFlow/evidence/final-test.txt) |
| Built-package HTTP workflow and close/restart durability | 0 | [final-demo.txt](../../../Session01/Assignments/ChangeFlow/evidence/final-demo.txt) |

[final-summary.json](../../../Session01/Assignments/ChangeFlow/evidence/final-summary.json) records
the exact commands, counts, runtime and SHA-256 hashes of all source, tests, scripts and package.json.
The F1 tests cover invalid create/edit/feedback input without stored changes and exact valid
Persian/emoji content round trips. The targeted source review also confirmed F1 closed.

No remaining buildable gap was identified in the final convergence assessment. Human acceptance,
remote publication, production security/capacity and untested operating systems are not claimed.
