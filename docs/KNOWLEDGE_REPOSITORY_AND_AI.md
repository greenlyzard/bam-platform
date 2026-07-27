# Knowledge Repository & Role-Scoped AI

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-27

---

## 1. What this is

A tenant-level document repository that serves **people and the AI from the same store, under the same access rules.**

Two consumers, one source of truth:

- **Humans** browse and search it — a teacher opens the handbook, front desk opens the pricing breakdown.
- **Angelina** retrieves from it — grounded answers instead of hallucinated policy.

And one hard requirement: **what the AI will say is bounded by what the asker is allowed to read.** Not by prompt instruction. By retrieval.

### 1.1 The problem it solves

`Important Links.docx` is the evidence. It is a hand-maintained index of 15+ Google Docs, a Canva handbook, 8 BAND groups, 2 tracking spreadsheets, and a Google Form. That document exists because the knowledge is scattered and nobody can find anything.

Concrete symptoms in the material reviewed 2026-07-27:

- **The Staff & Teacher Handbook says "Season 5 – 2025/26."** It is last season's, and nothing surfaces that.
- **The Handbook and the Teacher Code of Conduct overlap and disagree.** Both cover conduct, communication, and student safety, at different depths. An AI reading both will contradict itself.
- **The Code of Conduct opens with a stray "Final"** — a working title left in a published document.
- **Not everything is staff-level.** The Front Desk & Manager Listings doc carries hourly pay bands ($22–$35/hr) and is a hiring artifact, not a staff policy.

**Reconciliation is editorial work and must happen before ingest.** Ingesting two documents that disagree automates the disagreement.

---

## 2. Access model

### 2.1 Scoping happens at retrieval, never in the prompt

The Angelina teacher context already carries the instruction *"Never share another teacher's schedule, pay, or student details."* **That is a prompt, not a control.** A prompt is a request; a query filter is a boundary.

Every retrieval — documents and live data alike — resolves through one function that answers *what may this person see*, and queries within that boundary. Nothing reaches the model that the asker was not entitled to.

### 2.2 Document visibility

Per-document, by role. Default is **the narrowest tier, not the widest** — a document with no explicit visibility is admin-only until someone widens it.

| Tier | Who | Example |
|---|---|---|
| `public` | Anyone, unauthenticated | Class schedule, tuition rates, trial process |
| `parent` | Authenticated parents | Dress code, attendance policy, performance dates |
| `staff` | Teachers, front desk, admins | Staff Handbook, Code of Conduct, injury procedure, front desk duties |
| `admin` | Admins only | Job listings with pay bands, disciplinary procedure, compensation policy |

**Most of what BAM has today is `staff`.** The exception worth calling out: the Front Desk & Manager Listings doc is `admin` — it contains pay bands. Do not let one document's sensitivity force the whole corpus upward; split it instead.

> ⚠️ `requireAdmin()` admits five roles including `finance_admin` and `studio_manager`. `has_finance_role()` admits two. Compensation-adjacent documents must use the finance boundary, not the admin one — see `CLAUDE.md` §4.

### 2.3 Live-data visibility

The same resolver governs operational tables. This is where row-level scoping matters:

| Asker | Sees |
|---|---|
| Teacher | Own classes, own students, own timesheet, own sub requests |
| Parent | Own family only — their children, their balance, their schedule |
| Front desk | Studio-wide operations; **not** compensation |
| Admin | Studio-wide |
| Finance | Compensation |

**Row-level is the expensive part and it is not optional.** "Teachers can see timesheets" is a role. "Teachers see their own timesheet and not Cara's" is a row filter, and it is the one that matters.

---

## 3. Schema

> ⚠️ Verify every column against live schema before implementing. Written from investigation, not a schema dump. Note `studio_resources` and `family_documents` already exist and may overlap — check before adding a third document table.

```
knowledge_documents
  id, tenant_id
  title, slug
  category            -- policy | procedure | handbook | reference | form | hiring
  visibility          -- public | parent | staff | admin
  source_type         -- upload | google_doc | google_sheet
  source_url          -- nullable; where it was drafted
  file_path           -- storage path for the uploaded artifact
  mime_type
  content_text        -- extracted plain text, what gets chunked
  version             -- integer, increments on re-upload
  last_reviewed_at    -- set by a human, not by upload
  reviewed_by
  stale_after_days    -- tenant default; drives the stale flag
  is_active
  created_at, updated_at, created_by

knowledge_chunks
  id, tenant_id, document_id
  chunk_index, content, token_count
  embedding vector
  -- visibility is NOT stored here; always joined from the parent document
  -- so a visibility change takes effect immediately without re-embedding
```

**`last_reviewed_at` is deliberately separate from `updated_at`.** A document can be re-uploaded without being reviewed, and reviewed without being changed. The handbook problem — "Season 5 – 2025/26" sitting unnoticed — is a review failure, not an edit failure.

---

## 4. Ingest

### 4.1 Format flexibility is cheap

`.docx`, `.xlsx`, `.pdf`, `.md`, plus Google Docs and Sheets. All extract to text. The platform already has tooling for the first four.

### 4.2 Source-of-truth flexibility is not

Two models, and the choice is load-bearing:

| | Sync from Google Drive | Upload to platform |
|---|---|---|
| Editing | Stays where Amanda already works | Google Docs becomes the drafting tool |
| Freshness | Automatic | Requires a re-upload step |
| Failure mode | **Silent** — a moved or renamed doc breaks with no signal; no way to know which version the AI read | **Visible** — the doc is stale and the platform says so |
| Per-tenant cost | OAuth, permission drift | None |

**Recommendation: upload, with `source_url` recording where it was drafted.** The failure you can see beats the one you cannot. Amanda's handbook has been a season out of date for months precisely because nothing surfaced it.

Pair it with a **staleness flag** — documents past `stale_after_days` since `last_reviewed_at` appear in the admin surface and, once §6 exists, generate a notification.

### 4.3 What does not belong here

**The Company Contract survey is not knowledge base material.** 150 rows of dance approvals, competition selections, Parent Guild signups, and a Blue/Pink meeting triage column — that is per-student operational data. Ingesting it would mean answering questions about specific children from a spreadsheet.

It is a **form-and-workflow feature** the platform should own, and it is its own spec.

---

## 5. Retrieval — the three shapes

A single question box, three different retrieval paths behind it. Getting this wrong is the main design risk.

| Shape | Example | Source |
|---|---|---|
| **Policy** | *"Do I need approval to schedule a sub?"* | Documents |
| **Data** | *"Has my sub request been approved?"* | `substitute_requests`, scoped to asker |
| **Both** | *"I need a sub for Thursday — what do I do?"* | Policy + whether Thursday is even their class |

The third shape is where the value is and where the complexity lives. It needs the policy answer, the asker's own schedule, and the current state of their requests — assembled together, scoped identically.

### 5.1 Cross-referencing targets

Live tables the assistant should reach, all through the same resolver:

`approval_tasks` · `substitute_requests` · `absence_records` · `notifications` · `communication_threads` · `timesheets` + `timesheet_entries` · `enrollments` · `classes` · `schedule_instances` · `student_evaluations` · `billing_tasks`

**Two of these are broken today and would poison answers:**

- `notifications` — 88 rows, **100% unread**, because no admin surface renders them. See `FINANCIAL_ANOMALY_DETECTION.md` §2.1.
- `billing_tasks` — **write-only.** One writer, no reader, no UI. Same doc, §2.2.

An assistant answering *"what needs my attention?"* from tables nothing else surfaces is doing real work — but it also means the assistant becomes the only surface, which is the wrong dependency. Fix the surfaces first.

### 5.2 Accuracy constraints inherited from the data

The assistant is only as correct as what it reads:

- **`schedule_instances` has no working generator** (`_INDEX.md` task 19). *"Is there class on Labor Day?"* is unanswerable until occurrences exist.
- **Server-side dates are UTC** below Phase D of `TENANT_TIMEZONE_SPEC.md`. An assistant confidently stating the wrong day is worse than no assistant.
- **Angelina currently reads `teacher_hours`, not `timesheet_entries`** — the table payroll actually pays from. See `PAYROLL_CORRECTNESS_AND_REPORTING.md` §2.5. It reports hours that do not feed anyone's paycheck, from a table with zero rows.

---

## 6. Relationship to notifications

**Alongside, not instead of.** Both are needed, and they answer different questions:

| Surface | Question | Nature |
|---|---|---|
| Notification bell | *Something happened* | Push, ambient, countable |
| Assistant | *What does it mean, what do I do* | Pull, conversational |

A bell with a badge tells a teacher their timesheet was returned. The assistant tells them why and what to fix. Neither substitutes for the other.

**Order matters:** build the notification surface first (`FINANCIAL_ANOMALY_DETECTION.md` §3.1 — the table and API already exist, only the UI is missing). Otherwise the assistant becomes the sole path to information that should be visible without asking.

---

## 7. Channels

The repository is channel-agnostic. Each surface is its own build.

| Channel | State | Notes |
|---|---|---|
| **Admin/staff chat** | Nearest — `/admin/chat` exists, `tenants.angelina_enabled` is true | Authenticated, roles resolve normally |
| **Parent portal chat** | Same mechanism, `parent` scope | Row-level family filter is the whole game |
| **Public website widget** | New security posture | **No user, so no role.** Cannot reuse the authenticated context path. `public` documents plus published class data only |
| **Email** | Groundwork exists — `communications_inbox` | Inbound parsing + reply path |
| **Phone (Quo)** | Largest lift | Speech-to-text, latency budget, and a spoken error cannot be scrolled back |

**An incumbent exists.** BAM already runs an AI agent answering texts and calls. Before building, establish what it is and whether feeding it beats replacing it — a third-party tool with its own knowledge base may be cheaper to point at this repository than to displace.

### 7.1 Public widget — the different one

Unauthenticated means no `AuthUser`, no `profile_roles`, no row filter. It must run through a **separate, deliberately narrow** retrieval path:

- `visibility = 'public'` documents only
- Class data only where `is_hidden = false` and `online_registration = true`
- **Never** any student, family, enrollment, or staff record

Do not reuse the authenticated assembler with a null user. That is how a scoping bug becomes a data leak.

---

## 8. What the assistant must not do

**Placement recommendations.** Recommending a level for a child is a judgment Amanda and her teachers make from watching them dance. *"Your 7-year-old should be in 2B"* is confidently wrong in a way that affects a child's experience and a parent's trust.

The schema already agrees: `evaluation_requests` and `season_placements` exist, and placement runs a staged → released workflow with admin approval. That is deliberate.

**Acceptable:** *"Here are the classes typically for ages 6–8, and here's how to book an evaluation."*
**Not acceptable:** *"She should be in 2B."*

Same boundary applies to anything requiring professional judgment — injury, disciplinary matters, and anything touching mandated reporting, which has a legal process the assistant must route to rather than answer.

---

## 9. Build order

| Phase | Scope | Depends on |
|---|---|---|
| **0** | **Editorial** — reconcile the Handbook and Code of Conduct, update the season, split hiring docs from staff docs | Amanda; blocks everything |
| **1** | `knowledge_documents` schema + upload + text extraction + admin management UI | — |
| **2** | Human-facing document library — browse, search, download, role-filtered | Phase 1 |
| **3** | Chunking, embeddings, retrieval with visibility join | Phase 1 |
| **4** | Staff assistant — policy questions, documents only | Phase 3 |
| **5** | Cross-reference to live data via the shared resolver | Phase 4; notification surface first |
| **6** | Parent portal assistant | Phase 5; **row-level family scoping is the risk** |
| **7** | Public widget — separate narrow path | Phase 3 |
| **8** | Email / phone channels | Phase 5; resolve the incumbent question first |

**Phase 2 delivers value with no AI at all.** A searchable, role-filtered staff library replaces `Important Links.docx` on its own. If the AI work stalls, that still shipped.

---

## 10. Open questions for Amanda

1. **Handbook vs Code of Conduct** — which is canonical where they disagree? Or should they merge?
2. **What is the existing text/phone agent?** Feed it or replace it.
3. **Front desk visibility** — front desk sees pricing and duties. Should they see the disciplinary policy? The Code of Conduct in full?
4. **Parent-facing policies** — which of the staff documents have a parent-facing equivalent that should be `parent`-visible rather than `staff`?
5. **Review cadence** — how often should a document be re-reviewed before it flags stale? 6 months? Annually at season start?
6. **BAND** — the repository does not replace BAND messaging (`COMMUNICATIONS_HUB.md` covers that), but the BAND group links live in `Important Links.docx`. Do those belong here, or in the communications module?

---

## 11. Related

- `docs/COMMUNICATIONS_HUB.md` — BAND replacement; messaging, not documents
- `docs/FINANCIAL_ANOMALY_DETECTION.md` — the notification surface this depends on
- `docs/PAYROLL_CORRECTNESS_AND_REPORTING.md` §3.5 — Angelina payroll context and the `teacher_hours` bug
- `docs/TENANT_TIMEZONE_SPEC.md` — date correctness the assistant inherits
- `docs/SECURITY.md` — RLS templates; note its examples are stale
