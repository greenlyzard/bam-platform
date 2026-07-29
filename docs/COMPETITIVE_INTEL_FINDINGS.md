# Competitive Intelligence — Findings & Method

**Status:** Research notes + method recommendation
**Author:** Derek Shaw
**Date:** 2026-07-28
**Source:** Public web research, 2026-07-28. Spot-checked, not exhaustive.

---

## 1. What this is, and what it is not

A first pass at what South Orange County ballet and dance studios publish publicly. It is **not** a complete competitive picture, and §4 explains why that requires a different method than searching.

Everything below is from public pages and may be stale. Verify before pricing decisions.

---

## 2. Pricing benchmarks found

### Southland Ballet Academy (Festival Ballet Theatre) — Fountain Valley & Irvine

The most credentialed classical competitor in the county. Founded 1983, Vaganova method, official school of Festival Ballet Theatre.

| Program | Published tuition |
|---|---|
| Intermediate — 4× 2-hr ballet + 1-hr contemporary weekly | **$648/month** |
| Next level — + 1-hr character | **$680/month** |
| Higher level — 5× 2-hr ballet + character + contemporary | **$720/month** |
| Optional 30-min stretch class | +$10/month |
| Summer open/drop-in, pre-pro daytime | **$250/week**, or $80/day Mon, less Tue–Thu |
| Summer Intensive (ages 11–20) | **$2,700** total, half by Feb 15, balance by Apr 30, $500 non-refundable |
| Junior Summer Intensive (ages 9–12) | **$1,500** total, same structure |
| Video audition fee | $40 |

**Read:** serious pre-professional pricing, $650–720/month for 9–11 hours weekly. That is roughly **$16–18/hour of instruction** at volume. They are not competing on price; they are competing on pedigree and hours.

### Tutu School Ladera Ranch — ages 6 months to 8 years

Franchise, boutique, story-driven. Directly targets **BAM's stated growth segment (ages 3–5)** and is 20 minutes from San Clemente. Owner Brooke Taylor Luminelli: UC Irvine BFA, Disneyland and Tokyo Disney performing background.

Pricing is not published on public pages — it sits behind their registration flow. Notable published policies:

- **Free trial class** as the standard entry point
- **Unlimited make-up classes** for as long as you are enrolled
- Tuition **pro-rated** for mid-month joiners
- Card required on file even for a free trial and for waitlist holds
- Explicitly **not** a drop-off program — parents remain on site

**Read:** the make-up policy and free trial are the competitive levers, not price. "Unlimited make-ups" is a strong retention promise and an operational cost most studios avoid.

### San Clemente Dance & Performing Arts Center — 1321 Calle Avanzado

Established 1995 by Judy Corfman Kelly. **ABT National Training Curriculum affiliate.** Nationally ranked competition teams, auditioned once yearly. Ages 2 through adult. Tap, ballet, jazz, lyrical, contemporary, hip hop, musical theater, tumbling, breakdancing, ballroom.

**Published hours** — useful for white-space analysis:

| Day | Open |
|---|---|
| Mon–Wed | 10:00am–12:00pm, 2:30pm–8:00pm |
| Thu | 10:00am–12:00pm |
| Fri | 2:30pm–8:00pm |
| Sat | 9:00am–2:00pm |
| Sun | Closed |

Yelp: 92% recommend across 21 reviews. Price range listed as `$$`.

**Read:** the closest direct competitor geographically, and the broadest offering. The **10am–12pm weekday block** is a deliberate early-childhood window — worth noting against BAM's ages 3–5 priority. **Thursday afternoons and evenings appear closed**, and **Sunday is closed entirely**.

### Also in the area, not yet researched

Pacific Coast Academy of Dance (Talega, San Clemente — founded 2002 by Sandra Russell Ishida), Capistrano Academy of Dance, South Coast Conservatory, Pacific Ballet Conservatory, Moxie, On Deck, Variant, Pave School of the Arts, Bonjour Ballet.

---

## 3. What the findings suggest

**Three price tiers exist and BAM should know which it is in.** Southland at $650–720/month for pre-professional hours; Tutu School at boutique early-childhood with retention-led policies; San Clemente Dance as the broad multi-discipline neighbour. These are not the same market, and a family choosing between them is choosing between three different things.

**Nobody in this set publishes a per-class rate.** Everyone sells a monthly enrollment. A per-class price is a discovery advantage and a margin risk simultaneously.

**Tutu School's make-up policy is the retention lever to study.** Unlimited make-ups is expensive to operate and hard to match casually. It is also exactly the kind of thing that shows up in a P&L as unbilled capacity — which is why event and class accounting (`EVENT_ACCOUNTING_AND_EXPENSES.md`) has to exist before matching it.

**Published operating hours are the most useful raw material.** Competitor closed hours are BAM's uncontested hours. San Clemente Dance being closed Sundays and Thursday afternoons is a concrete, checkable fact — unlike anything inferred about their enrollment.

---

## 4. Why this cannot be done by searching, and what to do instead

Two searches produced two usable price tables and one schedule. Scaling that to eleven studios, refreshed over time, will not work by the same method:

- **Most schedules live behind portals.** Southland's live class list is on iClassPro; others use Studio Pro, Jackrabbit, or DanceStudio-Pro. Those are dynamic pages that a search index does not represent well.
- **Pricing is increasingly gated.** Tutu School's tuition is inside the registration flow, not on a page.
- **Staleness is invisible.** A cached 2024 schedule looks identical to a current one.

**Recommended method:**

1. **A structured `competitor_studios` and `competitor_offerings` table** — studio, location, program, ages, day, time, discipline, published price, source URL, `observed_on`. Every row carries when it was seen, so age is visible rather than assumed.
2. **Manual or semi-automated collection on a cadence** — quarterly is enough. Schedules change seasonally, not weekly.
3. **Respect robots.txt and terms.** Public pricing pages are fair to read; portal scraping is not, and the reputational cost in a small community is real.
4. **Separate fact from inference.** "San Clemente Dance is closed Sundays" is a fact with a source and a date. "They have weak Sunday demand" is a guess. Angelina should be able to tell them apart, which means the schema must.

The existing `docs/COMPETITIVE_INTEL.md` spec should absorb this — the finding is that **collection cadence and provenance are the design problem**, not the analysis.

---

## 5. Immediate, actionable for Amanda

Three things worth acting on without any further build:

**The 10am–12pm weekday block.** San Clemente Dance runs it Monday through Thursday. If BAM's ages 3–5 growth is the priority, that window is a proven local demand signal, and it is outside school hours for that age group — the one age band where daytime works.

**Thursday afternoon and Sunday are locally uncontested** at the nearest competitor. Worth testing against BAM's own capacity rather than assumed.

**Southland's $648–720/month sets the county ceiling** for serious classical training. If BAM's advanced tuition is materially below that, there may be room — and if it is above, the pedigree comparison will be made by families whether or not the studio makes it.

---

## 6. Related

- `docs/COMPETITIVE_INTEL.md` — the existing spec; §4 here is the method it needs
- `EVENT_ACCOUNTING_AND_EXPENSES.md` §5 — white-space analysis consumes this data
- Studio positioning: "Real ballet training in a nurturing environment" — deliberately between Southland's pre-professional intensity and the recreational studios
