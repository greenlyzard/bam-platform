# BAM Platform — UX Patterns & Design System

## Design Philosophy

The BAM platform should feel like the physical studio experience translated to software:
**elegant, nurturing, professional, and never overwhelming.**

Every screen should pass this test: *Would Amanda Cobb be proud to show this to a Royal Ballet parent?*

---

## Layout Patterns

### Shell Layouts (role-specific)

**Parent Portal Shell**
```
┌─────────────────────────────────┐
│  [BAM Logo]        [Avatar] [🔔] │  ← Minimal top nav
├─────────────────────────────────┤
│                                 │
│         Page Content            │
│                                 │
├─────────────────────────────────┤
│  [Home] [Classes] [Learn] [More] │  ← Bottom nav (mobile)
└─────────────────────────────────┘
```

**Teacher Portal Shell**
```
┌──────────┬──────────────────────┐
│          │  Page Header         │
│  Side    ├──────────────────────┤
│  Nav     │                      │
│          │  Page Content        │
│  (icons  │                      │
│  +labels)│                      │
└──────────┴──────────────────────┘
```
Sidebar: 240px desktop, collapses to icon-only at 1024px, bottom nav on mobile.

**Student LMS Shell**
- Full-screen, no nav chrome
- Single swipe-up feed
- Back button only escape

**Admin Shell**
- Full sidebar nav (desktop only — admin doesn't use mobile)
- Dense data layout acceptable
- Data tables over cards for volume

---

## Component Patterns

### Cards

**Student Card**
```tsx
<DancerCard
  name="Sofia"
  age={7}
  level="Level 1"
  nextClass="Tuesday 4:30pm"
  avatar="/sofia-avatar.jpg"
  badges={['arabesque-achiever', 'perfect-attendance']}
/>
```
Style: white/ivory bg, lavender-pale border, soft shadow, 16px radius, dancer photo circular.

**Class Card**
```tsx
<ClassCard
  name="Pre-Ballet"
  teacher="Ms. Amanda"
  schedule="Monday 4:00–4:45pm"
  enrolled={8}
  capacity={10}
  level="Ages 3–5"
  style="ballet"
/>
```
Style: capacity shown as subtle fill bar at bottom (lavender fill). Full = gold warning.

**Badge Card**
- Circular, 64px
- Thin gold border
- Icon inside (thin outline style)
- Tooltip on hover: badge name + earned date
- Locked badges shown at 30% opacity with lock overlay

---

### Navigation

**Primary Nav Items (Parent Portal)**
- Home (grid icon)
- My Dancers (silhouette icon)
- Schedule (calendar icon)
- Payments (receipt icon)
- Messages (chat icon)

**Primary Nav Items (Teacher Portal)**
- Today (sunrise icon)
- My Classes (layout icon)
- Students (users icon)
- Content (video icon)
- Messages (chat icon)

**Active state:** lavender background, slightly bolder label, gold left indicator on desktop sidebar.

---

### Buttons

```tsx
// Primary — main CTA
<Button variant="primary">Book a Trial Class</Button>
// Style: bg-[#9C8BBF], text-white, rounded-full, px-8 py-3, hover:bg-[#8A78B0]

// Secondary — alternative action
<Button variant="secondary">View Schedule</Button>
// Style: border border-[#9C8BBF], text-[#9C8BBF], rounded-full, bg-transparent

// Gold CTA — high emphasis
<Button variant="gold">Enroll Now</Button>
// Style: bg-[#C9A84C], text-white, rounded-full

// Ghost — low emphasis
<Button variant="ghost">View All</Button>
// Style: no border, text-[#6B6B7B], hover:text-[#2C2C2C]

// Destructive — careful actions
<Button variant="destructive">Remove Student</Button>
// Style: bg-[#C47A7A], text-white — only for truly destructive actions
```

---

### Forms

**Inputs**
```css
/* Standard input */
border: 1px solid #E8E0F0;     /* light lavender border */
border-radius: 8px;
padding: 12px 16px;
background: #FFFDF9;           /* warm white */
font-family: Nunito;
font-size: 16px;               /* always 16px+ on mobile to prevent zoom */

/* Focus state */
border-color: #9C8BBF;
box-shadow: 0 0 0 3px rgba(156, 139, 191, 0.15);

/* Error state */
border-color: #C47A7A;
box-shadow: 0 0 0 3px rgba(196, 122, 122, 0.15);
```

**Form Layout Rules**
- Full-width inputs on mobile
- Labels above inputs (never placeholder-only)
- Error messages below input in soft red (#C47A7A), small text
- Success state: soft green checkmark right-aligned in input
- Required fields: asterisk (*) in gold, not red
- Never use CAPTCHA (use Supabase rate limiting instead)

---

### Empty States

Never show a blank page or generic "No data" text.

```tsx
// Empty enrollments
<EmptyState
  icon={<BalletShoesIcon />}
  title="No classes yet"
  description="Explore our programs to find the perfect class for your dancer."
  action={<Button variant="primary">Find a Class</Button>}
/>
```

Empty states should:
- Use a thin outline ballet-themed icon
- Speak in BAM voice (warm, encouraging)
- Always include an action

---

### Loading States

- **Skeleton loaders** for content cards (not spinners)
- Skeletons use lavender-pale (#F0EBF8) pulsing animation
- Full-page loading: centered small lavender spinner + "BAM" wordmark
- Never block UI for non-critical data

---

### Notifications & Toasts

```tsx
// Success
toast.success("Sofia has been enrolled in Pre-Ballet.")

// Info
toast.info("Class is at capacity. Sofia has been added to the waitlist.")

// Warning
toast.warning("Payment due in 3 days.")

// Error
toast.error("Something went wrong. Please try again or call (949) 229-0846.")
```

Style: top-right, slide-in from right, 4s auto-dismiss, lavender accent bar on left side.

---

## Mobile UX Rules

1. **Thumb zone first** — primary actions in bottom 40% of screen
2. **Min touch target: 44px** — no smaller tappable elements
3. **Font size ≥ 16px** on all inputs (prevents iOS zoom)
4. **Bottom sheet** instead of modals for mobile overlays
5. **Swipe gestures** for student LMS feed (up = next, down = previous)
6. **Pull to refresh** on class schedule and attendance views
7. **Sticky CTAs** — enrollment/payment buttons stick to bottom on scroll

---

## Student LMS Feed (TikTok-style)

**Swipe Direction:** Up = next video, Down = previous  
**Autoplay:** Yes, muted (unmute on tap)  
**Controls:**
```
┌─────────────────────────┐
│                         │
│   [Video Content]       │
│                         │
│                    [♡]  │ ← Like
│                    [🔖] │ ← Save
│                    [↩]  │ ← Replay
│                         │
│  Pre-Ballet             │ ← Level tag
│  Arabesque Tips         │ ← Title
│  Practice this week!    │ ← Caption
│                         │
│  ████░░░░ 45s / 90s     │ ← Progress bar
└─────────────────────────┘
```

**Age gates in feed:**
- Content tagged with age_min/age_max
- Student only sees appropriate content
- Teachers can promote content to specific students ("Featured for Sofia")

---

## Badge / Achievement Display

**In-context (student profile):**
```
[Badge] [Badge] [Badge] [Badge] [+3 more]
```
Horizontal scroll row, 64px circles, gold border on earned, grey on locked.

**Full achievement wall:**
Grid layout, constellation background matching current level, earned badges glow.

**Badge earned animation:**
- Burst of soft gold particles
- Badge scales from 0 to 1 with spring physics
- Sound: optional soft chime (teacher-uploadable audio)
- Text: "Beautiful work, Sofia. You've earned the Arabesque Achiever badge."

---

## Live Stream UI

**For Parents (watching)**
```
┌─────────────────────────────┐
│ 🔴 LIVE  Pre-Ballet          │
│ Ms. Amanda · 8 watching     │
│                             │
│   [Video Stream]            │
│                             │
│ [Full Screen]  [Cast]  [⚙] │
└─────────────────────────────┘
```

**For Teachers (broadcasting)**
```
┌─────────────────────────────┐
│ [Camera Preview]            │
│                             │
│  ● 8 parents watching       │
│                             │
│  [END STREAM]               │
│  [Start Recording]          │
└─────────────────────────────┘
```

Red pulsing dot for LIVE indicator. Gold for recording indicator.

---

## Accessibility Requirements

- **WCAG 2.1 AA** minimum
- Color contrast ≥ 4.5:1 for all text
- All interactive elements keyboard navigable
- Screen reader labels on all icon-only buttons
- `aria-live` regions for dynamic content (attendance, stream status)
- Focus visible at all times (never remove outline)
- Alt text on all images (student photos: "Ballet student at barre")
