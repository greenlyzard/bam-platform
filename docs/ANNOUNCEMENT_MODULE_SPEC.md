# BAM Platform Announcement and Communications Module

Version: 0.1  
Date: 2026-07-23  
Status: Planning specification for repository review  
Owner: Derek  
Primary operator: Amanda

## 1. Recommendation

Build one announcement and event module inside the proprietary BAM Platform. It will be the system of record for public announcements, class-specific notices, key dates, competition dates, casting communications, SMS, newsletters, and website announcement feeds.

Do not create separate dates manually in WordPress, Quo, and the newsletter platform. Amanda should enter or update the underlying information once. The module should determine the appropriate audience and channels, generate channel-specific versions, require a preview, and dispatch approved communications.

WordPress must receive only public, website-approved content through read-only iframe endpoints. Private enrollment, class, team, guardian, student, competition, and casting data must never be exposed through a public embed.

## 2. Objectives

1. Enter key dates and announcements once.
2. Target communications by studio, program, class, level, team, production, competition group, household, student, or staff role.
3. Publish selected announcements to approved website areas.
4. Send consented SMS through Quo.
5. Send segmented or personalized newsletters through a replaceable email provider.
6. Communicate casting privately to the correct guardians and dancers.
7. Support Amanda with a conversational drafting workflow without allowing unreviewed public sends.
8. Preserve an audit trail, audience snapshot, delivery status, and rollback or cancellation path.

## 3. Non-goals for the first release

- Replacing the full class scheduling or enrollment system
- Two-way chat inside the BAM Platform
- Sending MMS through Quo
- Allowing an AI agent to publish or send without a human confirmation
- Exposing private class, student, guardian, casting, or competition details on WordPress
- Building a drag-and-drop email designer comparable to a mature email platform
- Migrating historical Studio Pro communications
- Automatically posting to social media
- Editing WordPress pages or Flatsome UX Blocks from the announcement module

## 4. Users and permissions

### 4.1 Administrator

Can:

- Configure providers, placements, templates, permissions, and compliance settings
- Create, approve, schedule, publish, cancel, and archive communications
- Review complete delivery logs
- Manage website embed allowlists
- Configure audience rules

### 4.2 Communications manager

Intended for Amanda.

Can:

- Create and edit drafts
- Select audiences using approved segments
- Generate channel variants
- Send tests to an internal test group
- Preview recipient counts and examples
- Schedule and publish after explicit confirmation
- Cancel future deliveries

Cannot:

- View or export provider API keys
- Change role permissions
- change integration security
- Execute arbitrary code
- Bypass consent or suppression rules
- Publish private data to public embeds

### 4.3 Instructor or team manager

Can be allowed to:

- Draft notices for assigned classes or teams
- Suggest event changes
- View delivery status for communications they own

Cannot send or publish unless separately granted.

### 4.4 Guardian or adult student

Can:

- View communications applicable to their household or enrollment
- Manage eligible communication preferences
- View private casting assignments when authorized
- Follow secure links to full details

### 4.5 Integration service

Use separate service identities for Quo, email, and website embeds. Grant only the permissions required by each integration.

## 5. Core concepts

### 5.1 Event

An authoritative dated item such as:

- Studio closure
- Registration deadline
- Audition
- Performance
- Rehearsal
- Camp or intensive
- Competition
- Open house
- RSM construction or opening milestone
- Class schedule exception

An event may exist without generating a communication.

### 5.2 Announcement

A communication record that references an event when applicable. It contains the approved message, audience, channels, publishing window, and delivery plan.

### 5.3 Campaign

A group of related announcements across multiple channels, dates, or audiences. Example: Nutcracker auditions can include a website card, an all-family newsletter section, an eligible-level email, and SMS reminders.

### 5.4 Audience

A saved rule or explicit selection that determines recipients. Audiences may use:

- Studio
- Program
- Class
- Level
- Company or competition team
- Production
- Cast
- Event registration
- Enrollment status
- Guardian or adult-student status
- Staff role
- Household

### 5.5 Placement

A named website destination that can render public announcements:

- `global-announcement-bar`
- `homepage-featured`
- `san-clemente-announcements`
- `rsm-announcements`
- `registration-announcements`
- `performances-announcements`
- `competitions-public`

Placements must be configured records rather than arbitrary user-entered strings.

### 5.6 Delivery

One attempted channel delivery to a recipient or public placement. Store queued, processing, sent, delivered, failed, suppressed, cancelled, and expired states.

## 6. Announcement categories

The first release should support:

1. Studio closure
2. Registration deadline
3. New-session enrollment
4. Performance
5. Audition
6. Camp or intensive
7. Schedule change
8. Homepage or location banner
9. Emergency notice
10. Fundraising
11. Competition
12. Casting
13. General newsletter

Category templates should provide recommended required fields without forcing every category into the same form.

## 7. Data model

Adapt names and types to the existing repository conventions. Do not duplicate existing people, enrollment, class, studio, event, or authorization tables.

### 7.1 `events`

Required conceptual fields:

- `id`
- `organization_id`
- `event_type`
- `title`
- `summary`
- `description`
- `starts_at`
- `ends_at`
- `timezone`
- `all_day`
- `venue_id`
- `location_text`
- `status`: draft, confirmed, postponed, cancelled, completed
- `public_visibility`
- `created_by`
- `updated_by`
- timestamps

### 7.2 Event scope joins

Use normalized joins to existing entities:

- event to studio
- event to program
- event to class
- event to level
- event to team
- event to production
- event to competition

Do not store comma-separated identifiers.

### 7.3 `announcements`

- `id`
- `organization_id`
- `campaign_id`
- `event_id`, nullable
- `category`
- `internal_name`
- `headline`
- `summary`
- `body`
- `cta_label`
- `cta_url`
- `status`: draft, ready_for_review, approved, scheduled, active, completed, cancelled, archived
- `visibility`: public, authenticated, targeted
- `publish_starts_at`
- `publish_ends_at`
- `priority`
- `created_by`
- `approved_by`
- `approved_at`
- `updated_by`
- timestamps
- optimistic concurrency or version field

### 7.4 `announcement_channels`

One row per announcement and channel:

- channel: in_app, website, sms, email
- enabled
- channel-specific subject
- preview text
- channel-specific body
- sender configuration
- scheduled time
- approval state
- template version

Never truncate one master body automatically and send it without a channel preview.

### 7.5 `audience_definitions`

- `id`
- `name`
- `description`
- `rule_json` using a validated schema
- `owner`
- `active`
- timestamps

Rules must be evaluated on the server. Do not trust a client-provided recipient list.

### 7.6 `announcement_audiences`

- announcement
- saved audience
- inclusion or exclusion
- optional explicit household, guardian, staff, or adult-student target

### 7.7 `recipient_snapshots`

Create an immutable audience snapshot when a send is approved:

- announcement
- channel
- recipient or household
- reason included
- destination reference
- consent state
- suppression result
- personalization data version
- created time

Do not store unnecessary plaintext phone numbers or email addresses in logs if secure references will suffice.

### 7.8 `deliveries`

- announcement
- channel
- recipient snapshot
- provider
- provider message identifier
- idempotency key
- status
- attempt count
- queued, sent, delivered, failed, and suppressed timestamps
- normalized error code
- estimated and actual SMS segments when available
- cost estimate when available

### 7.9 `website_placements`

- stable placement key
- name
- allowed visibility: public only
- allowed categories
- default item limit
- theme variant
- empty-state behavior
- enabled

### 7.10 `casting_productions`

- production or event reference
- title
- status
- release date
- release state
- approved by
- notes visible to staff only

### 7.11 `casting_assignments`

- casting production
- student
- role
- group or scene
- understudy information
- public-display permission
- private notes kept separately
- released timestamp

Guardians with multiple students should receive an aggregated household view. Casting assignments are private by default.

### 7.12 `communication_preferences`

Track at least:

- recipient
- channel
- communication category
- operational or marketing purpose
- opt-in source and timestamp
- opt-out source and timestamp
- legal or policy version
- status

Maintain a hard suppression list that cannot be bypassed by normal users.

## 8. Audience-resolution rules

1. Resolve audiences from current BAM Platform relationships.
2. Default class communications to enrolled guardians and eligible adult students.
3. Exclude withdrawn, inactive, deleted, or otherwise ineligible relationships according to existing business rules.
4. Deduplicate guardians who have multiple students in the same audience.
5. Personalize a single household communication with relevant details for each student when appropriate.
6. Show the operator:
   - total recipients
   - included segment counts
   - excluded and suppressed counts
   - sample recipients using authorized data
7. Recalculate counts before approval if underlying enrollment changes.
8. Freeze the recipient snapshot when the send is approved.
9. Require a new approval if the audience changes materially after approval.

## 9. Website iframe publishing

### 9.1 Public embed endpoints

Provide responsive, read-only routes such as:

```text
/embed/announcements/{placement_key}
```

Optional query parameters may control only approved presentation choices:

- item limit within placement limits
- compact or card layout
- light or dark approved theme
- language if localization is implemented

Do not allow query parameters to expose arbitrary audience, class, student, team, casting, or private-event filters.

### 9.2 Security

- Return public announcements only.
- Never include private identifiers or recipient data.
- Use a Content Security Policy with explicit `frame-ancestors` for approved BAM domains.
- Maintain a server-side origin allowlist.
- Use strict origin validation for `postMessage`.
- Escape all user content.
- Sanitize links and allow only approved protocols.
- Prevent search indexing of standalone embed routes when appropriate while keeping the parent page content strategy deliberate.
- Add cache headers compatible with scheduled publishing and emergency invalidation.
- Log configuration and rendering errors without private content.

### 9.3 Responsive sizing

Implement a small parent-page integration script or documented iframe wrapper that:

1. Receives height messages from the BAM Platform iframe.
2. Verifies the exact message origin.
3. Updates the iframe height without scrollbars.
4. Handles mobile content changes and orientation changes.

Provide a no-script fallback with a safe minimum height and a link to the public announcement page.

### 9.4 WordPress and Flatsome use

The website team will place the iframe wrapper in controlled Flatsome UX Blocks. Amanda should choose placements in the BAM Platform; she should not edit iframe URLs or UX Blocks for each announcement.

## 10. Quo SMS integration

Quo was formerly OpenPhone. Current official documentation states:

- API access requires an active Quo subscription.
- Workspace Owner or Admin permission is required to configure access.
- US carrier registration is required for messaging US numbers.
- API messaging uses prepaid credits.
- The API uses API keys.
- Outbound API SMS is billed by message segment.
- The current API does not support MMS.
- Each API key is limited to 10 requests per second.
- Webhooks can report received and delivered message events and must be signature verified.

### 10.1 Adapter

Create a provider-neutral `SmsProvider` interface. Implement `QuoSmsProvider` behind it.

Expected operations:

- estimate segments
- validate destination
- enqueue message
- send message
- retrieve provider status when needed
- process signed webhook
- normalize provider errors

### 10.2 Queue behavior

- Never send synchronously from the user’s HTTP request.
- Use a durable job queue or the repository’s established background-job system.
- Limit Quo calls below the documented maximum with configurable throttling.
- Retry transient failures using exponential backoff and jitter.
- Do not retry permanent validation, consent, or carrier errors.
- Use an idempotency key per recipient, announcement, channel, and approved version.
- Pause a campaign when failure or suppression thresholds are exceeded.
- Display estimated message segments and cost before approval.
- Warn when Unicode, emojis, accented characters, or smart punctuation reduce segment capacity.

### 10.3 Consent and replies

- Send only to numbers with the required consent or documented operational basis.
- Keep operational and marketing preferences separate.
- Default recipients to guardians rather than minors.
- Respect suppression immediately.
- Process inbound STOP, START, HELP, and other required keywords according to confirmed Quo and carrier behavior.
- Store inbound replies in the appropriate communication record without exposing them publicly.
- Escalate replies requiring human action to the Quo shared inbox or an internal work queue.

Claude Code must verify whether Quo itself automatically handles opt-out keywords for API sends. Do not assume this behavior.

### 10.4 Secrets

Store Quo API keys and webhook signing secrets only in the project’s approved secret manager and runtime environment. Never commit them, print them, include them in fixtures, or expose them to the client.

## 11. Newsletter and email integration

Do not hard-code Klaviyo or another provider until Derek confirms the production email system.

Create a provider-neutral `EmailProvider` interface supporting:

- transactional or operational message
- campaign or newsletter send
- test send
- template rendering
- status and event ingestion
- unsubscribe and suppression synchronization

### 11.1 Newsletter composer

Allow Amanda to:

1. Choose a base newsletter template.
2. Add announcement or event sections.
3. Select the audience.
4. Choose universal sections and segment-specific sections.
5. Generate subject and preview-text drafts.
6. Preview representative household variants.
7. Send a test to an internal test group.
8. Review recipient and suppression counts.
9. Confirm and schedule.

### 11.2 Personalization

Support safe variables such as:

- guardian preferred name
- student first name where appropriate
- studio
- enrolled class names
- relevant dates
- secure portal links

Do not put sensitive account, payment, medical, or private student information into email.

### 11.3 Casting communication

For casting:

- Keep assignments private by default.
- Require an approved release state before communication.
- Build one household email containing only that household’s assignments.
- Prefer a secure portal link for full details.
- Use SMS only as a brief notice that casting is available, unless BAM explicitly approves role details by SMS.
- Create a separate explicitly approved public cast-list artifact if BAM chooses to publish one.
- Do not expose unpublished casting through website embeds, logs, analytics, or client-side payloads.

## 12. AI-assisted drafting

The AI drafting feature may:

- Convert a structured event into channel drafts.
- Suggest missing facts.
- Produce a website headline, SMS draft, email section, subject, preview text, CTA, and alt text.
- Apply BAM voice and formatting rules.
- Estimate SMS segments.
- Flag private or potentially inappropriate content for a channel.

The AI must not:

- Invent dates, times, prices, eligibility, assignments, links, or policies.
- Select a private audience without showing the operator.
- Publish or send without confirmation.
- Override suppression or consent.
- infer casting or enrollment.
- Expose minors’ information.

Store the approved final text, not hidden model reasoning. Record which user approved it and which source event version it used.

## 13. State machine and approvals

Recommended state flow:

```text
draft
  -> ready_for_review
  -> approved
  -> scheduled
  -> active/sending
  -> completed/expired
```

Alternative states:

```text
draft -> cancelled
scheduled -> cancelled
active -> withdrawn
```

Require explicit approval after:

- audience selection
- final channel content
- scheduled send or publishing time
- estimated SMS segment count and cost
- public website placements

Any edit to audience, date, destination, casting assignment, or channel text after approval must invalidate the prior approval.

## 14. Operator interface

### 14.1 Dashboard

Show:

- Drafts needing completion
- Communications awaiting approval
- Scheduled communications
- Active website announcements
- Recent sends and delivery health
- Failed deliveries
- Events without communications
- Announcements approaching expiration

### 14.2 Wizard

Recommended steps:

1. What is being announced?
2. Which event or authoritative date does it use?
3. Who needs it?
4. Which channels?
5. Draft content
6. Preview each channel
7. Test send
8. Review recipients, privacy, timing, and cost
9. Confirm

Amanda should see parent-language descriptions rather than raw database or integration terminology.

### 14.3 Emergency workflow

Emergency notices may use a shortened wizard but must still require:

- authorized operator
- explicit audience
- exact message preview
- channel confirmation
- final send confirmation

Do not let “emergency” bypass consent, privacy, or recipient validation.

## 15. API and service boundaries

Adapt route naming to the existing architecture. Conceptual services:

- Event service
- Announcement service
- Audience resolver
- Personalization renderer
- Approval service
- Website embed service
- Delivery orchestrator
- SMS provider adapter
- Email provider adapter
- Webhook processor
- Audit log

Potential API surface:

```text
POST   /announcements
GET    /announcements/{id}
PATCH  /announcements/{id}
POST   /announcements/{id}/resolve-audience
POST   /announcements/{id}/generate-drafts
POST   /announcements/{id}/preview
POST   /announcements/{id}/send-test
POST   /announcements/{id}/approve
POST   /announcements/{id}/schedule
POST   /announcements/{id}/cancel
GET    /embed/announcements/{placement_key}
POST   /webhooks/quo
POST   /webhooks/email/{provider}
```

Use the repository’s existing authentication, authorization, validation, API, and error conventions.

## 16. Reliability and observability

- Use a transactional outbox or equivalent so approved database changes and queued deliveries cannot diverge silently.
- Make webhook processing idempotent.
- Verify webhook signatures before parsing trusted fields.
- Store provider event IDs to deduplicate retries.
- Add structured logs without message bodies or private recipient data unless explicitly required and secured.
- Add metrics for queued, sent, delivered, failed, suppressed, and cancelled deliveries.
- Alert on queue backlog, high failure rate, invalid webhook signatures, provider credit failure, and embed rendering failures.
- Provide a campaign-level delivery report.
- Support cancellation of unsent jobs.

## 17. Security and privacy

- Follow least privilege.
- Enforce authorization on the server for every announcement, audience, casting, and delivery operation.
- Apply row-level security if the current platform uses it.
- Never trust organization, studio, class, or audience identifiers supplied only by the client.
- Encrypt sensitive data at rest using the platform’s established controls.
- Keep secrets out of source control and logs.
- Retain only the communication data necessary for operations, audit, consent, and legal requirements.
- Prevent exports unless explicitly authorized.
- Record all views and changes to private casting information when practical.
- Use secure, expiring links for private personalized content.

## 18. Testing requirements

### 18.1 Unit tests

- State transitions
- Audience inclusion and exclusion
- Household deduplication
- Consent and suppression
- Casting privacy
- Template rendering
- SMS segmentation
- Provider error normalization
- Scheduling and expiration

### 18.2 Integration tests

- Quo adapter using mocks or sandbox-safe fixtures
- Signature verification
- Webhook idempotency
- Email-provider contract
- Queue retry behavior
- Transactional outbox behavior
- Website embed filtering

### 18.3 End-to-end scenarios

1. Public RSM opening announcement displayed on approved website placements.
2. Class-specific schedule change sent only to enrolled households.
3. Competition dates sent only to selected teams.
4. Public performance promoted by website and newsletter.
5. Casting assignments privately released to the correct households.
6. Guardian with two dancers receives one correct consolidated email.
7. Opted-out recipient is suppressed.
8. Updated event invalidates a previously approved unsent communication.
9. Cancelled event withdraws public embeds and cancels queued reminders.
10. Quo rate-limit or credit failure pauses safely and reports the problem.

### 18.4 Security tests

- Unauthorized audience access
- Cross-studio and cross-organization access
- Private fields in public embed payload
- HTML and URL injection
- Forged webhook
- Replay webhook
- IDOR attempts
- client-side audience manipulation

## 19. Rollout phases

### Phase 0: repository discovery and design confirmation

- Inspect existing architecture and data model.
- Identify reusable event, enrollment, identity, authorization, queue, notification, audit, and provider components.
- Produce a gap analysis.
- Confirm email provider.
- Confirm Quo workspace and registration status without requesting secrets in chat.

### Phase 1: announcements and in-app delivery

- Event references
- Announcement records
- Audience resolver
- Draft, preview, approval, scheduling
- In-app targeted display
- Audit log

### Phase 2: public website embeds

- Placement configuration
- Public-only projection
- iframe endpoints
- responsive-height integration
- WordPress integration documentation

### Phase 3: Quo SMS

- Provider adapter
- consent and suppression
- queue and throttling
- tests and delivery webhooks
- test-number rollout
- production approval checkpoint

### Phase 4: newsletters

- Email provider adapter
- newsletter composer
- segment personalization
- test and approval workflow
- delivery events

### Phase 5: casting

- Production and assignment model
- private release workflow
- household aggregation
- portal display
- private email notification
- explicitly separate public cast-list workflow

## 20. Definition of done

The module is complete only when:

- Amanda can create one event or announcement and choose appropriate channels.
- Class, team, competition, production, and household targeting use current platform relationships.
- Private announcements never appear in a public iframe.
- Website placements update without manual WordPress date entry.
- Quo sends through a queued, consent-aware, rate-limited adapter.
- Newsletters can contain common and segment-specific sections.
- Casting releases show each household only its authorized assignments.
- All external sends and public publishing require preview and explicit approval.
- Deliveries are auditable and idempotent.
- Scheduled content expires correctly.
- Tests cover audience, privacy, consent, embeds, providers, and failure recovery.
- No secret is committed.
- Production rollout and rollback procedures are documented.

## 21. Unresolved decisions

Claude Code should not guess these:

1. Existing BAM Platform stack and architecture
2. Existing event, enrollment, household, class, team, and authorization schema
3. Background-job or queue technology
4. Production email/newsletter provider
5. Quo number type, carrier-registration status, and consent flow
6. Whether adult dancers can receive direct SMS or email
7. Exact rules distinguishing operational and marketing messages
8. Website embed hostnames and final placement list
9. Casting public-release policy
10. Communication retention periods
11. Required quiet hours and emergency exceptions
12. Whether translations are required

## 22. Confirmed external constraints

Research date: 2026-07-23

- Quo API overview: https://support.quo.com/core-concepts/integrations/api
- Quo API product page: https://www.quo.com/api
- Quo rate limits: https://www.quo.com/docs/mdx/api-reference/rate-limits
- Quo webhook guide: https://www.quo.com/docs/mdx/guides/webhooks
- Quo carrier registration: https://support.quo.com/getting-started/carrier-registration/carrier-registration
- Quo API pricing and SMS segments: https://www.quo.com/docs/mdx/pricing-support/pricing-overview

Reverify these before production implementation because provider capabilities and policies can change.
