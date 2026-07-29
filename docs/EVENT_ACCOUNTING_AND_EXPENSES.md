# Event Accounting, Expenses & Budgets

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-28
**Investigated against live DB:** 2026-07-28
**Layer:** 3 of the five-layer finance architecture scoped 2026-07-11

---

## 1. Why this exists

Amanda needs to answer four questions the platform cannot answer today:

1. **Did Nutcracker make money?** Revenue against costumes, venue, teacher time, and materials.
2. **What does a competition actually cost?** Entry fees, travel, hotels, per diem, teacher time — against what families paid.
3. **Are we on budget?** Set a number before the event, watch actuals against it.
4. **What should we schedule next season?** Which classes earn, which don't, and where the open capacity is.

The first three are accounting. The fourth is modeling, and it is only as good as the first three.

---

## 2. Findings

### 2.1 The ledger is already dimensioned — this is the good news

`ledger_entries` carries: `tenant_id`, `entry_group_id`, `account`, `direction`, `amount_cents`, `charge_status`, `occurred_at`, and then a full dimension set —

> `family_id`, `student_id`, `class_id`, `location_id`, **`event_id`**, `teacher_id`, `award_id`, `discount_id`, `product_id`, `jurisdiction_code`, `tax_rate_bps`

with `ledger_accounts` (slug, code, name, acct_type, normal_balance) and `ledger_period_closes`. Double-entry with a DB-enforced balance.

This is exactly what the July architecture called for: *"if the financial ledger is dimensioned correctly from the start… Layer 4's overhead allocation is 'write allocation rules that create expense entries tagged to classes.'"* That decision held. Event accounting is **additive**, not a rebuild.

### 2.2 Four things are missing

| Gap | Detail |
|---|---|
| **Nothing for `event_id` to reference** | No `events` table. `productions` exists (21 cols) but holds **0 rows**. There is **no `competitions` table at all**, despite `timesheet_entries.competition_id` existing as a column |
| **No expense capture** | No expense, vendor, bill, purchase, or budget table anywhere in the schema. Travel, entry fees, hotels, materials have nowhere to land |
| **Labor does not post to the ledger** | `timesheet_entries.amount_cents` now computes correctly (2026-07-28) but nothing writes it to `ledger_entries`. An event P&L today would show revenue and **zero** teacher cost — worse than no report |
| **No budgets** | Nothing to compare actuals against, no variance |

### 2.3 Ad-hoc tagging already exists in five places

`timesheet_entries.event_tag` (**free text, no CHECK**), `evaluation_templates.level_tag`, `evaluation_templates.program_tag`, `lms_content.tags`, `season_curriculum.level_tag`. Nothing coordinates them. Adding a sixth would be a mistake; §4.1 proposes one model.

### 2.4 `productions.performance_date` is singular

One date per production, so it cannot express a Nutcracker run of several shows. See `CALENDAR_AND_PUBLIC_EVENTS.md` §3.4 — the resolution is that performances become `schedule_instances` rows and the production becomes their **container**, which is also what makes it a usable accounting dimension.

---

## 3. Decisions settled

| Decision | Detail |
|---|---|
| **Actual P&L covers actual classes and events only** | No backward allocation of idle capacity. An empty Tuesday 11am slot is not a cost to be absorbed — it is an opportunity to be evaluated forward (§5) |
| **Financial dimensions are FKs, not tags** | Anything a P&L rolls up to references a real table with a stable id. Tags are for labels with no lifecycle (§4.1) |
| **Archive, never delete** | Historical rows reference events and tags. Archiving hides them from pickers and leaves rollups intact |
| **Reimbursements are not wages** | Under an accountable plan they are non-taxable. The payroll export carries three lines: gross wages, reimbursements, deductions (§4.4) |
| **Expenses post to the ledger on approval** | Approval is the accounting event, not submission |

---

## 4. Design

### 4.1 Two layers: entities and tags

The instinct to model this as a blog-style taxonomy is right for labels and wrong for money. **WordPress-style taxonomies are built to be merged, renamed, and deleted** — fine for content discovery, fatal as an accounting dimension. Merge two terms to tidy up and every historical P&L silently re-maps.

**Layer one — entities with a lifecycle stay real tables.**

```
events                      -- the accounting dimension ledger_entries.event_id points at
  id, tenant_id
  event_type_id             -- FK, tenant-configurable (production, competition,
                            --   intensive, workshop, camp, fundraiser…)
  parent_id                 -- self-FK: Season 2026/27 → Nutcracker → Act II
  name, code
  season_id                 -- scopes pickers so they don't grow forever
  starts_on, ends_on
  status                    -- planning | active | closed
  is_archived, archived_at
  budget_locked_at
  created_by, created_at
```

`productions` and any future `competitions` become **specialisations** of an event, or are folded into it with type-specific metadata. Given `productions` is empty, folding is cheaper than migrating.

**Immutable identity, editable label.** Renaming is free; the id never changes. **Merging two events is a restatement, not a rename** — an explicit, audited operation with a preview of affected rows, the same treatment §3.1 of the payroll spec gives retroactive rate changes. Deleting an event with ledger rows is impossible, not discouraged.

**Layer two — a taxonomy for labels with no lifecycle.** Cast group, curriculum level, content tag, event category.

```
tag_types   tenant_id, key, label, applies_to[], allows_hierarchy, metadata_schema
tags        tenant_id, type_id, parent_id, key, label, metadata jsonb,
            is_archived, sort_order
```

`metadata_schema` on the **type** is what keeps `metadata` from becoming a swamp: the type declares which fields its tags may carry, so a Cast Group tag and an Event Category tag are not the same shapeless blob.

`timesheet_entries.event_tag` — currently unconstrained free text — becomes a `tags` reference or is dropped.

### 4.2 Hierarchy and rollup

`parent_id` gives Season → Event → Sub-event. Rollup is a recursive CTE over the tree, summing ledger entries at every level.

**One decision, and it is not cosmetic:** if an event moves under a different parent in March, does a January report re-parent? Live hierarchy is normal for internal management reporting. It is wrong for anything anyone signs, because two runs of the same period disagree. Recommendation: **live hierarchy, with the tree version stamped on any exported or archived report**, so a saved report can be reproduced even after a reorganisation.

### 4.3 Expenses

```
expense_reports
  id, tenant_id, submitted_by, status,          -- draft | submitted | approved
                                                --   | rejected | reimbursed
  period_id, submitted_at, approved_by, approved_at,
  rejection_note, reimbursed_at, payroll_export_id

expense_lines
  id, report_id, tenant_id
  incurred_on date, amount_cents,
  category_id,                                  -- tenant-configurable
  event_id,                                     -- THE dimension. Nullable:
                                                --   not every expense is an event
  class_id, location_id,                        -- other dimensions where relevant
  vendor_name, description,
  receipt_url, is_mileage, miles, mileage_rate_cents,
  ledger_entry_group_id                         -- set on approval
```

**Expenses are not timesheet entries.** They have no hours, and `entry_type` has no expense value. They join payroll only at export.

**Receipts are the substantiation requirement**, not a nicety — an accountable plan needs them. This is the first feature in the platform requiring file storage with a retention policy.

**Mileage is an effective-dated rate**, exactly like `teacher_rates`: tenant-configurable, versioned by date, never a constant in code. A 2026 trip reimbursed at the 2027 rate is wrong in the same way repricing history is wrong.

**Approval mirrors the billing queue** — submitter, then finance. Guarded by `can_manage_pay()`: approving a reimbursement is authorising a payment.

**Can a parent submit?** Competition travel is often parent-paid. If families front costs the studio reimburses or offsets, that is a different workflow from staff reimbursement and touches the deduction question in payroll §3.8. **Open — see §7.**

### 4.4 Payroll export becomes three lines

| Line | Taxable | Source |
|---|---|---|
| Gross wages | Yes | `Σ timesheet_entries.amount_cents` |
| Reimbursements | **No** | `Σ` approved `expense_lines` for the period |
| Deductions | Post-tax | Authorised deductions (payroll §3.8) |

Running reimbursements through Square as wages inflates the W-2 and overpays payroll tax on money that was never income. This has to be right the first time it runs.

### 4.5 Budgets

```
event_budgets       event_id, version, created_by, created_at, locked_at
event_budget_lines  budget_id, category_id, direction (revenue|expense),
                    amount_cents, note
```

Budget lines use the **same category set as actuals**, or variance cannot be computed. Versioned and lockable so "what we planned" survives later edits — an unlocked budget that drifts toward actuals reports zero variance and teaches nobody anything.

Variance is `actual − budget` per category, rolled up the event tree.

### 4.6 Posting to the ledger

Three producers, one destination:

| Source | Trigger | Entry |
|---|---|---|
| Revenue | Existing billing (charges, credits, tuition) | Already posts; needs `event_id` populated where the charge relates to an event |
| Labor | Timesheet entry **approved** — not created | Debit labor expense, credit accrued payroll, dimensions from the entry: `event_id`, `class_id`, `teacher_id` |
| Expenses | Expense report **approved** | Debit expense category, credit reimbursement payable |

**Labor posts on approval, not on entry.** A draft entry is not a liability, and posting drafts would make the ledger churn with every edit. It also means `ledger_period_closes` and the timesheet period lock need to agree about when a period is settled.

**Every posting is idempotent and reversible by entry group**, never by editing a posted row. The ledger is append-only.

---

## 5. Looking backward vs forward

These are different computations and the product must label them differently.

**Backward — actuals.** Ledger entries tagged to classes and events. Revenue minus direct cost. No allocation, no estimation. Defensible because it is only what happened.

**Forward — modeling.** A hypothetical class has no ledger entries. Projected margin is expected enrollment × tuition, minus teacher rate × hours, against the marginal cost of a slot that is currently empty. **This is a model and must be rendered as one** — the risk is a projection appearing in the same table as an actual and being read as equally solid.

**Feasibility constraints are tenant configuration, not model inference.** "Ages 3–6 do not schedule past 6:30pm." "Weekday 9am–2pm is school hours for ages 5+." Amanda knows these; another studio's rules differ. Encoded as data they are auditable and portable; left to the model they are plausible-sounding and unverifiable.

```
scheduling_constraints
  tenant_id, min_age, max_age, day_of_week,
  earliest_start, latest_end, note, is_active
```

White-space analysis is then: room-hours available, minus room-hours scheduled, minus hours excluded by constraint, cross-referenced against demand signals (waitlists, enrollment by age and discipline) and competitor coverage.

---

## 6. Angelina's role

Angelina reading event P&L to recommend schedules is the payoff, and it inherits every access rule that got built today.

- **Finance gating.** Event margin reads teacher cost by definition. Amanda's Angelina can do this; a plain `admin`'s cannot. `can_manage_pay(tenant_id)`, enforced at the query, never in the system prompt (payroll §3.5).
- **Source is the ledger**, not report-time aggregation. Two systems computing margin differently is how a recommendation ends up disagreeing with the P&L it cites.
- **Projections are labeled.** When Angelina says a class would earn $X, the provenance — expected enrollment, assumed rate, constraint applied — must be inspectable. An unexplainable number that happens to be right is indistinguishable from one that is wrong.
- **Competitor data is only as current as its collection.** See `COMPETITIVE_INTEL_FINDINGS.md`.

---

## 7. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | **Fold `productions` into `events`, or keep both?** `productions` is empty, so folding is cheap now and expensive later | Phase 1 |
| 2 | **Can parents submit expenses?** Parent-fronted competition travel is a different workflow and touches payroll §3.8 | Phase 4 |
| 3 | **Mileage rate** — current figure, and who may change it | Phase 4 |
| 4 | **Expense categories** — the initial set. They must match budget line categories | Phase 4 |
| 5 | **Does labor post to the ledger on approval or on payment?** Approval gives accrual; payment gives cash. Accrual is more useful and more work | Phase 5 |
| 6 | **Live hierarchy or versioned?** (§4.2) | Phase 2 |
| 7 | **Chart of accounts and QBO mapping** — a bookkeeper's decision, not one to invent | Phase 5 |
| 8 | **Overhead allocation methodology** — deferred to Layer 4 and explicitly out of scope here. §3 removes the pressure to answer it by scoping actuals to actual events | Layer 4 |

---

## 8. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | `events` + `event_types`; decide the `productions` fold (§7 q1). Seed Nutcracker and the Fall competitions | Low |
| **2** | Hierarchy, archive, season scoping; event picker used by timesheets and the calendar | Low |
| **3** | `tag_types` / `tags`; retire `timesheet_entries.event_tag` free text | Low |
| **4** | Expense reports: submit, approve, receipts, mileage. **No ledger posting yet** | Medium |
| **5** | Ledger posting — labor on approval, expenses on approval, `event_id` on revenue | **High. The correctness centre of this spec** |
| **6** | Event P&L: actuals by event, rolled up the tree | Medium |
| **7** | Payroll export three-line format (§4.4) | Medium |
| **8** | Budgets + variance | Medium |
| **9** | `scheduling_constraints` + white-space analysis | Medium |
| **10** | Angelina read model over the ledger, finance-gated | Medium |
| **11** | Projection/modeling layer, labeled as projection | Medium |

Phases 1–3 are cheap and unblock the timesheet production picker, which is the immediate practical need.

---

## 9. Related

- `PAYROLL_CORRECTNESS_AND_REPORTING.md` — labor cost source; §3.3 visibility; §3.8 deductions; §3.9 admin patterns
- `PRIVATE_LESSON_BILLING_AND_CREDITS.md` — revenue side for privates; the queue pattern §4.3 mirrors
- `CALENDAR_AND_PUBLIC_EVENTS.md` — §3.4 production-vs-performance; events appear on both surfaces
- `BILLING_GENERALIZATION_SPEC_V2.md` — the ledger this depends on
- `FINANCIAL_ANOMALY_DETECTION.md` — an event with revenue and no cost is an anomaly worth surfacing
- `COMPETITIVE_INTEL_FINDINGS.md` — external input to §5
