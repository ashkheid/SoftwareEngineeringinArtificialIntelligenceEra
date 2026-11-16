# Source review — two axes

The code-review skill was adapted to uncommitted new files: fixed reference
`4bc636e69d177e2d4561b163db7bb34dcdca1d7f`, full new app source/tests, no new commit series.
No issue tracker was needed because Assignment and specs/001-changeflow were supplied directly.
The agents performed source inspection only; root executes reproductions and fixes under the
user's task authority. A usage interruption delayed the Spec agent, which resumed and completed.

## Standards
**Hard finding, P2:** domain.validateFields accepted unpaired UTF-16 surrogates. SQLite UTF-8
binding can replace these while create/edit return the original string, violating the durable
content guarantee in Constitution III. Reject malformed Unicode consistently before storage.
This was initially a source inference, not an executed reproduction.

**Judgment call:** the SQL listing query repeats Domain's visibility predicate. It matches the
documented listRequests(actor,...) design and current canRead behavior. Keep this explicit design
trade-off and cover parity; no general abstraction/refactor is required for this release.

No other architecture/security findings: role reads and mutations share BEGIN IMMEDIATE;
Domain owns self-review/state/ownership; SQL CAS and rollback exist; HTTP contains no approval policy.

## Spec
**P2:** FR-011 durable content can differ between the successful response and subsequent read
for escaped lone UTF-16 surrogates. HTTP accepts valid UTF-8 JSON bytes containing the escape;
Domain accepts the resulting string; SQLite converts it on binding. Reject the string and add
response-versus-persisted-content tests. This was initially source reasoning, not execution.

No other missing requirements, scope additions or wrong workflow behavior were found in reviewed
source. Current authority, visibility, independent review, state, metadata and CAS align with spec.
Build/demo/docs were reviewed separately by the root agent as they were completed afterward.

Counts: Standards 1 hard finding + 1 nonblocking design observation; Spec 1 finding. The hard
findings describe one shared defect, tracked as Converge F1 / T023. Follow-through and executed
evidence are recorded in convergence/validation reports, not retroactively represented as the
review agents having run tests.

## Targeted follow-up after Implement
The Standards reviewer inspected the correction and regression source: F1 is closed. The shared
String.isWellFormed() guard covers create, edit and feedback; tests exercise rejection without
stored mutation and preservation of valid Persian/emoji. Spec, data model and HTTP contract agree.
This follow-up remained source-only. Root separately reproduced the defect and ran the complete
final validation: build pass, 39/39 tests pass, built-package demo pass. No additional actionable
finding was reported. The visibility-query observation remains the documented design trade-off.
