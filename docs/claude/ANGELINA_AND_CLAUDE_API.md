# Angelina Chatbot & Claude API Integration
## BAM Platform — docs/claude/ANGELINA_AND_CLAUDE_API.md

---

## Overview

Angelina is BAM's AI-powered assistant powered by the Anthropic Claude API. She exists
in three deployment contexts with different system prompts and capabilities in each:

| Context | Where | Auth | Capabilities |
|---------|-------|------|-------------|
| **Public Website Widget** | WordPress site, any web page | None | Lead capture, class finder, FAQ, waiver/trial CTA |
| **Portal Chatbot** | Parent / Student / Teacher portals | Supabase session | Personalized schedule, cast info, announcements, payments |
| **Admin Assistant** | /admin pages | Admin session | Casting help, schedule conflicts, email drafting, data summaries |

---

## API Route (already built)

```
POST /api/chat
Body: { messages: [...], context: 'public' | 'portal' | 'admin' }
Auth: checked server-side — portal/admin require valid Supabase session
Rate limit: 20 req/IP/min (public), 60 req/user/min (portal/admin)
```

---

## System Prompts by Context

### 1. Public Website Widget

**File:** `lib/ai/prompts/public.ts`

Load these MD files at build time and inject into system prompt:
- `docs/claude/BRAND.md` — studio voice, values, BAM personality
- `docs/claude/CLASSES.md` — full class list with levels, ages, disciplines, fees
- `docs/claude/LEVEL_SYSTEM.md` — number/letter system explanation
- `docs/claude/REGISTRATION_AND_ONBOARDING.md` — trial booking, waiver flow

Prompt behavior:
- Warm, encouraging, dance-studio voice (never clinical)
- Guide visitors to: free trial booking, class finder, waiver
- Collect: name, child's age, dance experience, preferred days
- If unsure of placement → "We'd love to do a free assessment class!"
- Fallback: always offer phone (949-229-0846) or email
- Never discuss pricing beyond what's in CLASSES.md
- Max response length: 3 short paragraphs

Conversation pathways:
1. "What level is my child?" → ask age + experience → recommend 1–2 classes → link to trial
2. "What classes do you have on [day]?" → filter and list
3. "How much does it cost?" → explain per-class + Unlimited + "first class free"
4. "My daughter is nervous about starting" → warm reassurance + Petites/Level 1 suggestion
5. "Do you have [discipline]?" → confirm and list matching classes

### 2. Portal Chatbot (Parent/Student)

**File:** `lib/ai/prompts/portal.ts`

Additional context injected per-request (from Supabase, NOT hardcoded):
```typescript
// Fetched from DB and appended to system prompt:
const portalContext = `
STUDENT: ${student.first_name} ${student.last_name}, age ${student.age}
ENROLLED CLASSES: ${enrolledClasses.map(c => c.name + ' ' + c.days + ' ' + c.time).join(', ')}
CURRENT ROLES: ${roles.map(r => r.role_name + ' in ' + r.production_name).join(', ')}
UPCOMING REHEARSALS: ${nextRehearsal} (arrive by ${arriveTime}) at ${location}
NEXT PERFORMANCE: ${nextPerformance.name} on ${nextPerformance.date} at ${nextPerformance.venue}
ACCOUNT BALANCE: ${balance > 0 ? '$'+balance+' due' : 'current'}
ANNOUNCEMENTS: ${announcements.join('; ')}
`
```

Load these MD files:
- `docs/claude/BRAND.md`
- `docs/claude/CLASSES.md`
- `docs/claude/LEVEL_SYSTEM.md`
- `docs/claude/CASTING_AND_REHEARSAL.md`
- `docs/claude/PORTAL_FEATURES.md` (to be created — covers what parents can do in portal)

Capabilities:
- "When is [child]'s next rehearsal?" → answer from injected context
- "What should she wear to the show?" → pull from role's costume_url or notes
- "Can I switch her to a different class?" → explain process, link to /portal/schedule
- "What days is the studio closed?" → from BRAND.md calendar
- "I need to pay my balance" → link to /portal/billing

### 3. Teacher Portal Assistant

**File:** `lib/ai/prompts/teacher.ts`

Additional injected context:
```typescript
const teacherContext = `
TEACHER: ${teacher.name}
MY CLASSES TODAY: ${todayClasses}
STUDENTS WITH NOTES: ${studentsWithNotes}
UPCOMING REHEARSALS I'M LEADING: ${myRehearsals}
`
```

Capabilities:
- "Who's in my 4C ballet today?" → roster from DB
- "Any absences reported?" → check absences table
- "Draft a note to parents about [topic]" → email draft
- "Which of my students are in the Sylvia cast?" → from casting table

### 4. Admin Assistant

**File:** `lib/ai/prompts/admin.ts`

Load ALL md files plus:
- `docs/claude/CASTING_AND_REHEARSAL.md`
- `docs/claude/REGISTRATION_AND_ONBOARDING.md`
- `docs/claude/STACK.md`

Capabilities:
- "Which roles still need to be cast?" → query DB
- "Are there any schedule conflicts this week?" → check rehearsals
- "Draft an announcement for the Sylvia cast" → formatted email/post
- "How many students are enrolled vs capacity?" → summary

---

## Public Widget Embedding

The public chatbot is a standalone JS widget embeddable anywhere:

### On WordPress (current)
```html
<!-- In any page/post, or site-wide via footer widget -->
<script>
  window.BAM_CHAT_CONFIG = {
    apiBase:     "https://your-bam-platform.vercel.app",
    primaryColor:"#7B4FA8",
    accentColor: "#E8A0C0",
    greeting:    "Hi! I'm Angelina 🩰 How can I help you find the perfect class today?",
    ctaUrl:      "https://app.gostudiopro.com/online/balletacademymovement",
    studioPhone: "(949) 229-0846",
    studioEmail: "dance@bamsocal.com",
  };
</script>
<script src="https://your-bam-platform.vercel.app/widgets/chat.js" defer></script>
```

### On the Platform (native)
Import the React component directly — no iframe, no separate script:
```tsx
// In portal layouts and public pages
import { AngelinaChat } from '@/components/bam/chatbot-widget'
// Already in app/layout.tsx — passes context prop for portal vs public
<AngelinaChat context={session ? 'portal' : 'public'} student={session?.student} />
```

### Standalone script build (for WordPress drop-in)
```
// Build target: public/widgets/chat.js
// Vite config: lib mode, IIFE format
// Auto-injects CSS, no external deps required
// ~45KB gzipped
```

---

## Claude Code Prompts

### Prompt: Unify the chatbot component

```
Read docs/claude/ANGELINA_AND_CLAUDE_API.md, docs/claude/BRAND.md, and docs/claude/CLASSES.md.

Update components/bam/chatbot-widget.tsx to:
1. Accept a `context` prop: 'public' | 'portal' | 'admin'
2. When context='portal', fetch the student's enrolled classes, upcoming rehearsals, and
   next performance from Supabase and pass them as additional system context in the API call
   to /api/chat
3. When context='public', use the existing public system prompt
4. The chat UI should adapt: portal context shows the student's name in the greeting,
   public context uses the generic greeting
5. Keep the same floating widget UI but add a "minimize" button so portal users can
   collapse it while working

Update app/api/chat/route.ts to:
1. Accept a `context` field in the request body
2. Load the appropriate system prompt from lib/ai/prompts/[context].ts
3. For portal/admin contexts, validate the Supabase session before processing
```

### Prompt: Build the standalone widget script

```
Read docs/claude/ANGELINA_AND_CLAUDE_API.md.

Create public/widgets/chat-widget.html — a fully self-contained chatbot widget that:
1. Reads window.BAM_CHAT_CONFIG for configuration
2. Calls our /api/chat endpoint with context='public'
3. Has the same BAM design (primary #7B4FA8, Montserrat font, Cormorant Garamond headings)
4. Shows a floating button in the bottom-right corner with the BAM favicon
5. Opens to a chat panel with Angelina's greeting
6. Handles: class finder, level recommendations, trial booking CTA, fallback to phone/email
7. Is embeddable on any HTML page via a single <script> tag
This is for WordPress embedding before the full platform website is built.
```

---

## Shopping Cart — Portal Native Integration

The enrollment cart widget is currently a standalone HTML file.
It needs to be a proper React component for the portal.

### Portal enrollment flow

```
/portal/enroll
  → ClassGrid component (same data as widget, but fetches from Supabase)
  → EnrollmentCart (drawer/sidebar, same upsell logic)
  → CheckoutFlow (new)
    → Step 1: Review cart + Unlimited upsell
    → Step 2: Student profile (new or returning)
    → Step 3: Waiver (if new student or not on file)
    → Step 4: Apparel recommendations (new students only)
    → Step 5: Payment (via Studio Pro redirect OR Stripe if direct)
    → Step 6: Confirmation + "Would you like to be considered for performance/competition?"
```

### Claude Code Prompt: Build enrollment cart as React

```
Read docs/claude/REGISTRATION_AND_ONBOARDING.md and docs/claude/BRAND.md.

Create components/bam/enrollment-cart.tsx — a React enrollment cart that:
1. Fetches live class data from Supabase (classes table with level, discipline, enrollment)
2. Maintains cart state with useReducer
3. Shows the Unlimited upsell when 2+ classes are added and total > $249
4. Includes a multi-step checkout: review → student info → waiver → apparel → payment
5. New student detection: if student_id doesn't exist in DB, show apparel guide and waiver step
6. On waiver step: display waiver text from Supabase settings, collect digital signature
7. On final step: post enrollment to Supabase, then redirect to Studio Pro for payment
   (or Stripe if direct payment is enabled in studio settings)
8. After enrollment: trigger "performance consideration" prompt if class is a Level 3+ ballet
```

---

## MD Files Needed — Create These Next

Based on today's work, these docs need to be written and committed to docs/claude/:

| File | Status | Contents |
|------|--------|----------|
| `BRAND.md` | ✅ exists | Voice, colors, fonts, studio info |
| `STACK.md` | ✅ exists | Tech stack, deployment |
| `REGISTRATION_AND_ONBOARDING.md` | ✅ exists | Trial booking, waiver, student setup |
| `CHATBOT_AND_LEAD_CAPTURE.md` | ✅ exists | Angelina pathways |
| `CASTING_AND_REHEARSAL.md` | 🆕 create | Copy from today's spec doc |
| `CLASSES.md` | 🆕 create | Full class list, level system, disciplines, fees |
| `LEVEL_SYSTEM.md` | 🆕 create | Number=age, letter=skill, placement guide |
| `PORTAL_FEATURES.md` | 🆕 create | What parents/students/teachers can do in portal |
| `ANGELINA_AND_CLAUDE_API.md` | 🆕 this file | API prompts, embedding, widget build |
| `PERFORMANCE_AND_BROCHURE.md` | 🆕 future | Brochure, PDF, digital program |

---

## Timeline / What's Next

### NOW (Claude Code is ready — registration flow is queued)
Claude Code screenshot shows: registration flow prompt is the next active task.
**Accept the edits** on the registration flow Claude Code is building.

### AFTER registration flow is merged:
1. **Commit this MD file** to docs/claude/ANGELINA_AND_CLAUDE_API.md
2. **Create CLASSES.md and LEVEL_SYSTEM.md** (can be done quickly — data is all known)
3. **Give Claude Code the "Unify chatbot" prompt** above — makes chat portal-aware
4. **Give Claude Code the "enrollment cart React" prompt** — makes cart native to portal

### THEN (2–3 sessions from now):
5. Casting module DB migration (Prompt 1 from CASTING_AND_REHEARSAL.md)
6. Admin casting UI (Prompt 2)
7. Portal schedule views with rehearsal overlay (Prompt 3)
8. PDF cast sheets with QR codes (Prompt 4)
9. Standalone chat widget build (Prompt: "Build standalone widget script" above)

### LATER (once platform has its own domain/website):
10. Digital brochure + ticket-gated access
11. Competition module
12. WordPress password-protection replaced by platform auth
13. Performance consideration prompt in checkout flow

---

*Last updated: 2026-03-11 | Derek Shaw / BAM Platform*
