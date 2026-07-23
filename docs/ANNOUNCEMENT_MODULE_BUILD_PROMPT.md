# Claude Code Prompt: BAM Announcement and Communications Module

Copy the prompt below into Claude Code while it is opened at the root of the BAM Platform repository.

---

You are implementing an Announcement and Communications Module in the existing BAM Platform.

First read:

1. All repository-level and nested `CLAUDE.md`, `AGENTS.md`, README, architecture, security, schema, migration, testing, and deployment instructions.
2. The complete attached `ANNOUNCEMENT_MODULE_SPEC.md`.
3. Existing code for events, studios, programs, classes, enrollment, students, guardians or households, teams, productions, competitions, identity, authorization, notifications, email, queues, audit logs, webhooks, and public embeds.

## Non-negotiable architecture

- The BAM Platform is the system of record for key dates and announcements.
- Dates must not require duplicate entry in WordPress.
- WordPress consumes selected public announcements through read-only iframe endpoints.
- Private class, student, household, competition, and casting information must never appear in public embed responses or client-accessible payloads.
- External delivery must use provider adapters.
- Quo SMS must be queued, rate-limited, consent-aware, idempotent, and webhook-tracked.
- The email provider must remain replaceable until the current production provider is confirmed.
- All sends and public publishing require a human preview and explicit confirmation.
- Do not commit secrets or request that secrets be pasted into source code, documentation, or chat.
- Do not change production data, connect providers, deploy, or send messages during this task.

## Stage 1: repository discovery

Do not write implementation code immediately.

Inspect the repository and report:

1. Current framework, language, database, migration system, hosting, authentication, and authorization.
2. Existing data models relevant to this module.
3. Existing background-job, scheduling, webhook, notification, audit, and provider patterns.
4. Existing testing and deployment conventions.
5. The correct modules and directories for this work.
6. Conflicts between the specification and current architecture.
7. Components that can be reused.
8. Required schema additions and migrations.
9. Privacy and authorization risks.
10. A phased implementation plan with specific files.

Mark all assumptions. Ask only questions whose answers would materially change architecture, privacy, provider selection, or data migration.

Stop after the discovery report and wait for approval before implementing.

## Stage 2: implementation after approval

After the discovery plan is approved:

1. Implement the smallest coherent vertical slice first:
   - announcement record
   - audience resolution using existing enrollment relationships
   - in-app targeted display
   - preview
   - approval
   - scheduling and expiration
   - audit log
2. Add website embeds as a separate slice.
3. Add Quo behind an `SmsProvider` interface using mocks until credentials and production authorization are provided separately.
4. Add email behind an `EmailProvider` interface.
5. Add private casting only after the core audience and authorization model is proven.

## Required engineering controls

- Follow existing repository conventions rather than introducing a new framework.
- Use server-side authorization for every protected operation.
- Reuse existing tables and relationships when semantically correct.
- Use normalized join tables for scoped audiences.
- Use a validated schema for saved audience rules.
- Create immutable recipient snapshots at approval time.
- Use optimistic concurrency or an equivalent conflict check.
- Invalidate approval when the audience, event, channel content, timing, or casting data changes.
- Use a durable queue and a transactional outbox or the repository’s established equivalent.
- Use idempotency keys for deliveries and webhook processing.
- Verify webhook signatures before trusting data.
- Sanitize user-generated content and validate CTA URLs.
- Add structured logs without secrets or unnecessary recipient/message content.
- Never expose private identifiers in public embeds.
- Add migrations, rollback guidance, fixtures, and tests.

## Quo requirements

Use current official Quo documentation and verify it again during implementation:

- https://support.quo.com/core-concepts/integrations/api
- https://www.quo.com/docs/mdx/api-reference/rate-limits
- https://www.quo.com/docs/mdx/guides/webhooks
- https://support.quo.com/getting-started/carrier-registration/carrier-registration
- https://www.quo.com/docs/mdx/pricing-support/pricing-overview

Treat these as current working constraints:

- API keys are secrets.
- Outbound API messaging requires the applicable Quo account, carrier registration, and credits.
- Current API SMS is segment-billed.
- Current API does not support MMS.
- Current documented limit is 10 requests per second per API key.
- Webhook signatures must be verified.

Implement a configurable throttle below the provider maximum. Handle `429` and transient errors with exponential backoff and jitter. Do not retry permanent recipient, consent, or validation failures. Show SMS segment and cost estimates before approval.

Verify whether Quo handles STOP, START, and HELP automatically for API-sent messages. Do not assume it does.

## Public iframe requirements

Create named placement routes, not arbitrary filters. A conceptual route is:

```text
/embed/announcements/{placement_key}
```

The public projection must:

- return public and website-approved announcements only
- enforce active publishing windows
- expose no student, guardian, household, class-membership, team-membership, private competition, or private casting data
- use an allowlisted `frame-ancestors` policy
- safely support responsive iframe height with strict origin checking
- sanitize content and links
- have tests proving private records cannot leak

## Casting requirements

- Casting assignments are private by default.
- Release requires approval and a release timestamp.
- A guardian sees assignments only for authorized household students.
- A multi-student household receives one correct consolidated view.
- SMS should default to a brief “casting is available” notice with a secure portal link.
- A public cast list is a separate explicitly approved artifact.

## Test scenarios

Implement tests for:

1. Public RSM announcement shown in approved website placements.
2. Class notice sent only to currently enrolled households.
3. Competition notice sent only to selected teams.
4. Guardian with two dancers deduplicated correctly.
5. Suppressed phone or email excluded.
6. Private casting visible only to the authorized household.
7. Private announcement never emitted by an iframe route.
8. Event update invalidates unsent approval.
9. Cancellation removes website content and cancels pending jobs.
10. Quo rate limit, invalid signature, provider outage, and insufficient-credit failures.
11. Duplicate webhook and job retries do not duplicate deliveries.
12. Unauthorized cross-studio or cross-organization access is rejected.

## Completion report

For each approved implementation slice, report:

- files changed
- migrations added
- tests added and their results
- unresolved decisions
- security and privacy review
- configuration variables required, naming secrets without printing values
- local verification steps
- staging deployment plan
- rollback plan
- exact production checkpoint

Do not deploy or connect production services. Stop for approval before any external account connection, credential creation, provider send, data migration, or production change.

---
