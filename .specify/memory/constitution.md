# ChangeFlow Constitution

## Core Principles

### I. Business rules are independent of transport
Business decisions MUST live in Domain/Application. HTTP MUST only decode requests,
invoke use cases and encode results. Domain MUST NOT import HTTP, persistence or the
application layer. Application MUST NOT return HTTP status codes. Persistence MUST NOT
decide who may approve. This keeps the same rules available to future entry points.

### II. Identity and current authority govern every action
All request data MUST require authenticated identity. Mutations MUST evaluate current
roles, ownership and request state in the same atomic operation as persistence.
Self-approval MUST be rejected even for a user with both roles. Identity/roles from
request bodies or caller-selected headers MUST NOT be trusted. Secrets MUST NOT be
stored in source, returned in errors or written to request logs.

### III. Durable and atomic state
Successful mutations MUST persist before success is returned. A stale command MUST NOT
overwrite newer state; competing commands based on one version MUST have at most one
winner. A failed command MUST leave content, state, version and review metadata unchanged.
Approved content MUST be immutable. Transaction failures MUST roll back.

### IV. Traceable evidence rather than completion claims
Requirements MUST map to tasks, implementation and evidence. Tests MUST include the six
assignment scenarios and persisted-state assertions for sensitive failures. Source review
MUST assess architecture and security separately from test results. Analyze MUST be
read-only; Converge MUST only append remediation tasks, never fix application code.
Run results MUST state actual commands/counts/failures. Human acceptance MUST NOT be
claimed by the coding agent.

### V. Small, extensible first release
Use a single deployable API and the fewest modules needed for the above boundaries.
New dependencies and abstractions MUST have a concrete requirement and documented reason.
AI, RAG, MCP, workflow engines, frontend and distributed services are outside this release.

## Scope and Constraints
This constitution governs ChangeFlow and `specs/001-changeflow`, not the historical
BlogSpecLab course samples. The assignment and five HTML analyses are the input sources.
Use existing Spec Kit 1.4.0/Codex integration; do not reinstall it. Implementation choices
belong in plan/research; behavior and reviewable assumptions belong in the specification.

## Delivery Workflow
Constitution -> Specify/Clarify -> Plan/Research -> Tasks -> Analyze -> Implement ->
Build/Test/Validation -> Converge -> Implement outstanding tasks -> repeat affected checks.
This task explicitly authorizes implementation, review and assignment build/test evidence
without intermediate approval. No publication, commit or push is implied.

## Governance
This is version 1.0.0, adopted under the user's delegated authority on 2026-11-16, not a
claim of organizational or human acceptance. Changes must record rationale and affected
specifications/tasks. Breaking principles require a major version, new principles a minor
version, and wording corrections a patch. Review MUST identify exceptions explicitly;
passing tests cannot waive a principle.

**Version**: 1.0.0 | **Ratified**: 2026-11-16 | **Last Amended**: 2026-11-16
