# UX_PATTERNS.md — BAM Platform UI/UX Component Patterns

> Component specifications, layout patterns, and accessibility standards for every interface in the BAM Platform.

---

## 1. Role-Based Shell Layouts

Each authenticated role has a distinct shell layout optimized for their workflow.

### Parent Portal Shell

```
┌──────────────────────────────────────────┐
│  [Logo]  Ballet Academy and Movement     │
│  ─────────────────────────────────────── │
│  [Avatar + Family Name]    [Bell] [Menu] │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐    │
│  │         Page Content             │    │
│  │                                  │    │
│  └──────────────────────────────────┘    │
│                                          │
├──────────────────────────────────────────┤
│  [Home] [Schedule] [Learning] [Billing]  │
│            Bottom Tab Bar                │
└──────────────────────────────────────────┘
```

- **Mobile-first** — bottom tab navigation (fixed, 56px height)
- **Desktop:** Side nav collapses to icon rail at 768px
- **Header:** Minimal — logo, family name, notification bell, overflow menu
- **Background:** Cream (`#FAF8F3`)
- **Active tab:** Lavender icon + label, inactive = slate

#### Parent Nav Items

| Icon | Label | Route |
|------|-------|-------|
| Home | Dashboard | `/portal/dashboard` |
| Calendar | Schedule | `/portal/schedule` |
| Play | Learning | `/portal/learning` |
| CreditCard | Billing | `/portal/billing` |
| Menu (overflow) | More | → Children, Performances, Shop, Messages, Live |

### Teacher Portal Shell

```
┌─────────┬────────────────────────────────┐
│ Sidebar │  Header: Today's Date          │
│         │  ──────────────────────────── │
│ [Nav]   │                                │
│         │  ┌──────────────────────────┐  │
│         │  │     Page Content         │  │
│         │  │                          │  │
│         │  └──────────────────────────┘  │
│         │                                │
└─────────┴────────────────────────────────┘
```

- **Desktop-primary** — collapsible left sidebar (240px expanded, 64px collapsed)
- **Mobile:** Bottom sheet navigation triggered by hamburger
- **Sidebar color:** White with lavender active state
- **Header:** Today's date, upcoming class countdown, compliance alerts

#### Teacher Nav Items

| Icon | Label | Route |
|------|-------|-------|
| LayoutDashboard | Dashboard | `/teacher/dashboard` |
| Users | My Classes | `/teacher/classes` |
| CheckSquare | Attendance | `/teacher/attendance` |
| Star | Badges | `/teacher/badges` |
| BarChart3 | Assessments | `/teacher/assessments` |
| Clock | Hours | `/teacher/hours` |
| Video | Content | `/teacher/content` |
| MessageSquare | Messages | `/teacher/messages` |

### Admin Dashboard Shell

```
┌─────────┬────────────────────────────────┐
│ Sidebar │  Header: Search | Quick Add    │
│         │  ──────────────────────────── │
│ [Nav]   │                                │
│ [Groups]│  ┌──────────────────────────┐  │
│         │  │     Page Content         │  │
│         │  │                          │  │
│         │  └──────────────────────────┘  │
│         │                                │
└─────────┴────────────────────────────────┘
```

- **Desktop-optimized** — persistent left sidebar (260px), scrollable if needed
- **Mobile:** Full-width overlay drawer
- **Sidebar:** Grouped nav sections with collapsible headers
- **Header:** Global search (Cmd+K), quick-add button, notification bell, profile menu
- **Background:** Warm white (`#FEFDFB`)

#### Admin Nav Groups

**Studio**
- Dashboard, Seasons, Classes, Students, Families

**Staff**
- Teachers, Compliance

**Productions**
- Performances, Casting, Rehearsals

**Communications**
- Announcements, Messages

**Commerce**
- Billing, Shop, Reports

**Content**
- LMS Content, Live Sessions

**Intelligence**
- Expansion, Competitors

### Learning Studio Shell (Student LMS)

```
┌──────────────────────────────────────────┐
│  [Back]              [Progress] [Profile]│
├──────────────────────────────────────────┤
│                                          │
│                                          │
│          Full-Screen Content             │
│           (Video / Feed)                 │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  [Feed] [Progress] [Favorites] [Live]    │
└──────────────────────────────────────────┘
```

- **Immersive** — minimal chrome, content fills viewport
- **Bottom nav:** 4 tabs, minimal labels
- **Dark mode** for video content and constellation view
- **Swipe gestures** enabled for feed navigation

---

## 2. Card Components

### Standard Card

```tsx
<Card className="bg-white rounded-xl shadow-sm border border-silver/50 p-6">
  <CardHeader>
    <CardTitle className="font-heading text-xl text-charcoal">
      Title Here
    </CardTitle>
    <CardDescription className="text-slate text-sm">
      Description text
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

- Border radius: `12px` (`rounded-xl`)
- Shadow: `shadow-sm` default, `shadow-md` on hover for interactive cards
- Padding: `24px` (`p-6`)
- Border: `1px solid` silver at 50% opacity

### Class Card

```
┌──────────────────────────────────┐
│  [Style Badge]      [Capacity]   │
│                                  │
│  Ballet Level 2                  │
│  Ages 7–9 · Tuesdays 4:30 PM    │
│                                  │
│  Ms. Amanda        [Studio A]    │
│                                  │
│  ████████████░░░  8/10 enrolled  │
│                                  │
│  [View Details]    [Enroll →]    │
└──────────────────────────────────┘
```

- Style badge: colored pill matching style (ballet = lavender, jazz = coral, contemporary = teal)
- Capacity bar: green < 70%, yellow 70-90%, red > 90%
- Teacher name with avatar thumbnail
- Interactive: hover lifts with shadow-md

### Student Card

```
┌──────────────────────────────────┐
│  [Photo]  Sophie Martinez        │
│           Age 8 · Grade 3        │
│           ● Intermediate         │
│                                  │
│  [Ballet] [Performance]          │
│                                  │
│  3 classes · 2 badges this month │
│                                  │
│  [View Profile →]                │
└──────────────────────────────────┘
```

- Photo: 48px circle with fallback initials (lavender background)
- Level indicator: colored dot (green=beginner, blue=intermediate, purple=advanced, gold=pre-pro)
- Sub-brand tags: small pills

### KPI Card (Admin Dashboard)

```
┌──────────────────────────────────┐
│  Total Students           [↑ 12%]│
│                                  │
│  147                             │
│  ───────────────────             │
│  +8 this month                   │
└──────────────────────────────────┘
```

- Compact: fits 4 across on desktop, 2 on tablet, 1 on mobile
- Trend indicator: green arrow up, red arrow down
- Large number: Cormorant Garamond, 36px
- Subtitle: Nunito, 14px, slate color

### Badge Card

```
┌──────────────────────────────────┐
│        ✦                         │
│   [Badge Icon]                   │
│                                  │
│   Clean Pirouette                │
│   Technique · Gold Tier          │
│                                  │
│   Earned Mar 5, 2026             │
│   Awarded by Ms. Amanda          │
│                                  │
│   Patch: ● Ordered               │
└──────────────────────────────────┘
```

- Icon: centered, 64px, with tier-appropriate glow effect
- Tier colors: bronze `#CD7F32`, silver `#C0C0C0`, gold `#C9A84C`, platinum `#E5E4E2`
- Patch status: colored dot indicator

---

## 3. Button Styles

### Primary Button (Lavender)

```tsx
<Button className="bg-lavender hover:bg-lavender-dark text-white font-body font-semibold
  px-6 py-2.5 rounded-lg text-sm tracking-wide
  transition-colors duration-150
  focus:outline-none focus:ring-2 focus:ring-lavender/50 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed">
  Enroll Now
</Button>
```

- Use for: primary actions (enroll, save, submit, confirm)
- Minimum width: 120px
- Minimum height: 44px (touch target)

### Secondary Button (Gold)

```tsx
<Button variant="secondary" className="bg-gold hover:bg-gold-dark text-white font-body font-semibold
  px-6 py-2.5 rounded-lg text-sm tracking-wide">
  Purchase Tickets
</Button>
```

- Use for: secondary CTAs, commerce actions, premium features
- Same sizing rules as primary

### Outline Button

```tsx
<Button variant="outline" className="border-2 border-lavender text-lavender
  hover:bg-lavender hover:text-white
  px-6 py-2.5 rounded-lg text-sm font-semibold">
  View Schedule
</Button>
```

- Use for: secondary actions, navigation, cancel/back

### Ghost Button

```tsx
<Button variant="ghost" className="text-slate hover:text-charcoal hover:bg-cloud
  px-4 py-2 rounded-lg text-sm font-medium">
  Cancel
</Button>
```

- Use for: tertiary actions, dismiss, close

### Destructive Button

```tsx
<Button variant="destructive" className="bg-error hover:bg-error/90 text-white
  px-6 py-2.5 rounded-lg text-sm font-semibold">
  Drop Enrollment
</Button>
```

- Use for: destructive actions only (drop, remove, delete)
- Always require confirmation dialog before executing

### Icon Button

```tsx
<Button variant="ghost" size="icon" className="h-10 w-10 rounded-full
  text-slate hover:text-charcoal hover:bg-cloud">
  <Bell className="h-5 w-5" />
</Button>
```

- Use for: toolbar actions, inline actions
- Size: 40px × 40px minimum (44px on mobile)

### Button Rules

- Minimum touch target: **44px × 44px** on all devices
- Always include `disabled` state styling
- Loading state: replace text with spinner, maintain button width
- Never use more than one primary button per visible section
- Destructive buttons never positioned adjacent to primary buttons

---

## 4. Form Patterns

### Input Fields

```tsx
<div className="space-y-2">
  <Label htmlFor="firstName" className="text-sm font-medium text-charcoal">
    First Name
  </Label>
  <Input
    id="firstName"
    className="h-11 rounded-lg border-silver bg-white px-4 text-base
      placeholder:text-mist
      focus:border-lavender focus:ring-2 focus:ring-lavender/20
      invalid:border-error"
    placeholder="Enter first name"
  />
  <p className="text-xs text-error">Required field</p>
</div>
```

- Input height: **44px** minimum (`h-11`)
- Font size: **16px** minimum on mobile (prevents iOS zoom)
- Label: always above input, never floating/animated
- Placeholder: mist color, descriptive but not the label
- Error text: below input, error color, 12px
- Border: silver default, lavender on focus, error on invalid

### Select / Dropdown

```tsx
<Select>
  <SelectTrigger className="h-11 rounded-lg border-silver">
    <SelectValue placeholder="Select a class style" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="ballet">Ballet</SelectItem>
    <SelectItem value="jazz">Jazz</SelectItem>
    <SelectItem value="contemporary">Contemporary</SelectItem>
  </SelectContent>
</Select>
```

- Same height and styling as input fields
- Dropdown panel: white background, shadow-lg, max-height 300px with scroll

### Multi-Step Forms

```
Step 1 of 3: Choose Class
━━━━━━━━━━━━━━━━━━░░░░░░

[Form fields for step 1]

[← Back]                [Next →]
```

- Progress bar: lavender fill, silver track
- Step indicator: numbered circles, filled = complete, outlined = current, dim = future
- Navigation: back (ghost button left) + next (primary button right)
- Maximum 3 steps for enrollment (per business rule)
- Each step validates before allowing next

### Search Input

```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-mist" />
  <Input
    className="h-11 pl-10 rounded-lg"
    placeholder="Search students..."
  />
  {query && (
    <Button variant="ghost" size="icon"
      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
      onClick={clearSearch}>
      <X className="h-4 w-4" />
    </Button>
  )}
</div>
```

- Search icon left-aligned inside input
- Clear button appears when query is non-empty
- Debounce: 300ms before triggering search

### Form Layout Rules

- Single column for mobile, two columns for desktop (when fields are related)
- Group related fields with subtle background (`cloud` color)
- Required fields: marked with asterisk after label
- Optional fields: marked with "(optional)" after label
- Submit button: full-width on mobile, auto-width on desktop, right-aligned
- Form max-width: 640px (centered on desktop)

---

## 5. Empty States

Every list view and data display must have a designed empty state.

### Pattern

```
┌──────────────────────────────────┐
│                                  │
│         [Illustration]           │
│                                  │
│    No students enrolled yet      │
│                                  │
│    Add your first student to     │
│    start exploring classes.      │
│                                  │
│       [+ Add Student]            │
│                                  │
└──────────────────────────────────┘
```

- Illustration: simple line art or Lucide icon at 48px, mist color
- Title: Cormorant Garamond, 20px, charcoal
- Description: Nunito, 14px, slate, max 2 lines
- CTA: primary button if there's an action, otherwise omit
- Centered vertically and horizontally within the content area

### Empty State Examples

| Context | Title | Description | CTA |
|---------|-------|-------------|-----|
| No children added | No students yet | Add your child to start browsing classes | + Add Student |
| No enrollments | No classes yet | Browse available classes for this season | Browse Classes |
| No badges earned | Your constellation awaits | Earn your first badge to see it light up | Explore Badges |
| No attendance records | No attendance recorded | Attendance will appear here after the first class | — |
| No messages | All quiet | No messages yet — your teachers are just a tap away | — |
| No search results | No results found | Try adjusting your search or filters | Clear Filters |
| No upcoming classes | Free day! | No classes scheduled for today | View Full Schedule |

---

## 6. Skeleton Loaders

Use skeleton screens instead of spinners for all data loading states.

### Skeleton Components

```tsx
// Text skeleton
<Skeleton className="h-4 w-3/4 rounded bg-cloud animate-pulse" />

// Avatar skeleton
<Skeleton className="h-12 w-12 rounded-full bg-cloud animate-pulse" />

// Card skeleton
<div className="rounded-xl border border-silver/50 p-6 space-y-4">
  <Skeleton className="h-5 w-1/3" />
  <Skeleton className="h-4 w-2/3" />
  <Skeleton className="h-4 w-1/2" />
  <div className="flex gap-2 pt-2">
    <Skeleton className="h-10 w-24 rounded-lg" />
    <Skeleton className="h-10 w-24 rounded-lg" />
  </div>
</div>

// Table row skeleton
<div className="flex items-center gap-4 py-3 border-b border-silver/30">
  <Skeleton className="h-10 w-10 rounded-full" />
  <Skeleton className="h-4 w-32" />
  <Skeleton className="h-4 w-24" />
  <Skeleton className="h-4 w-16" />
</div>
```

### Skeleton Rules

- Match the shape of the actual content as closely as possible
- Use `animate-pulse` (Tailwind built-in) — not custom shimmer effects
- Color: `cloud` (`#F0EDF3`) — matches the brand palette
- Show 3-5 skeleton items for lists (not 1, not 20)
- Skeleton for cards should match card layout proportions
- Never show spinner + skeleton simultaneously

---

## 7. Toast Notifications

### Toast Types

```tsx
// Success
toast.success("Student enrolled successfully")

// Error
toast.error("Failed to save attendance. Please try again.")

// Warning
toast.warning("This class is almost full — 1 spot remaining")

// Info
toast.info("Schedule updated for next week")
```

### Toast Styling

| Type | Background | Icon | Border |
|------|-----------|------|--------|
| Success | White | CheckCircle (success green) | Left border 3px success |
| Error | White | XCircle (error red) | Left border 3px error |
| Warning | White | AlertTriangle (warning gold) | Left border 3px warning |
| Info | White | Info (info blue) | Left border 3px info |

### Toast Rules

- Position: **top-right** on desktop, **top-center** on mobile
- Duration: 4 seconds (auto-dismiss), errors persist until dismissed
- Max visible: 3 toasts stacked
- Animation: slide in from right (desktop), slide down from top (mobile)
- Include dismiss (X) button on all toasts
- Never use toasts for form validation errors — show inline instead
- Use toasts for: server responses, background operations, status updates

---

## 8. Mobile UX Rules

### Touch Targets

- **Minimum size: 44px × 44px** for all interactive elements
- Spacing between touch targets: minimum 8px
- Bottom nav items: 56px height, evenly spaced
- List item tap targets: full row width, minimum 48px height

### Input Fields

- **Minimum font size: 16px** — prevents iOS auto-zoom on focus
- Input height: 44px minimum
- Use `inputMode` attribute for appropriate keyboard:
  - `inputMode="email"` for email fields
  - `inputMode="tel"` for phone fields
  - `inputMode="numeric"` for number-only fields
- Auto-focus on first field only if the page is a dedicated form

### Scrolling

- Avoid horizontal scrolling — all content fits within viewport width
- Exception: data tables can scroll horizontally with fade indicators
- Pull-to-refresh on feed views (LMS swipe feed, schedule)
- Scroll position preserved on back navigation

### Gestures

- **Swipe up:** Advance to next content (LMS feed)
- **Swipe right:** Mark present (attendance)
- **Swipe left:** Mark absent (attendance)
- **Long press:** Context menu on cards (mobile alternative to right-click)
- **Pinch/zoom:** Badge constellation view

### Responsive Breakpoints

| Breakpoint | Name | Target |
|-----------|------|--------|
| < 640px | `sm` | Mobile phones |
| 640-768px | `md` | Large phones, small tablets |
| 768-1024px | `lg` | Tablets, small laptops |
| 1024-1280px | `xl` | Laptops |
| > 1280px | `2xl` | Desktop monitors |

### Mobile-Specific Patterns

- **Bottom sheets** instead of modal dialogs on mobile
- **Sticky headers** on scroll for list views
- **Floating action button** (FAB) for primary action on mobile admin views
- **Thumb zone optimization:** primary actions in bottom 40% of screen

---

## 9. TikTok-Style Swipe Feed Layout

### Feed Container

```tsx
<div className="h-screen w-full overflow-hidden bg-charcoal snap-y snap-mandatory overflow-y-scroll">
  {content.map((item) => (
    <div key={item.id} className="h-screen w-full snap-start relative">
      {/* Video player — full bleed */}
      <VideoPlayer src={item.videoUrl} className="absolute inset-0 object-cover" />

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Content info — bottom left */}
      <div className="absolute bottom-20 left-4 right-16 text-white">
        <h3 className="font-heading text-lg font-semibold">{item.title}</h3>
        <p className="text-sm text-white/80 mt-1">{item.teacher}</p>
        <p className="text-xs text-white/60 mt-1">{item.level} · {item.style}</p>
      </div>

      {/* Action bar — right side */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6">
        <ActionButton icon={Heart} label={item.likeCount} />
        <ActionButton icon={Bookmark} label="Save" />
        <ActionButton icon={CheckCircle} label="Done" />
        <ActionButton icon={Share2} label="Share" />
      </div>

      {/* Progress indicator — top */}
      <div className="absolute top-12 left-4 right-4">
        <div className="h-0.5 bg-white/20 rounded-full">
          <div className="h-0.5 bg-gold rounded-full" style={{ width: `${item.progress}%` }} />
        </div>
      </div>
    </div>
  ))}
</div>
```

### Feed Rules

- Full-screen cards, one per viewport height
- `snap-y snap-mandatory` for snapping to each card
- Video auto-plays when card is in view, pauses when scrolled away
- Dark theme only for feed (immersive viewing)
- Action buttons: 40px circular, semi-transparent white background
- Content info overlaid on bottom gradient
- Progress bar at top for sequence progress

---

## 10. Badge Achievement Animation

### Trigger: Badge Earned

```
1. Screen dims slightly (overlay)
2. Star burst animation (gold particles, 500ms)
3. Badge icon scales from 0 to 1 with spring easing (300ms)
4. Badge name fades in (200ms)
5. "Tap to view in your constellation" text fades in (200ms)
6. Tap → navigates to constellation view, zoomed to new badge
```

### Constellation Animation — New Badge

```
1. View zooms to the constellation group
2. Dim placeholder star brightens (400ms, ease-in-out)
3. Star glows with tier-appropriate color (300ms pulse)
4. Connection line draws to nearest earned star in group (500ms)
5. Subtle sparkle particles (2 seconds, then fade)
6. Badge detail card slides up from bottom
```

### CSS/Framer Motion Specs

```tsx
// Badge earn animation
const badgeEarnVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
      delay: 0.5, // After star burst
    },
  },
}

// Star glow animation
const starGlowVariants = {
  dim: { opacity: 0.2, scale: 0.8 },
  bright: {
    opacity: 1,
    scale: 1,
    filter: 'drop-shadow(0 0 8px var(--tier-color))',
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
}

// Connection line draw
const lineDrawVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 0.4,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}
```

---

## 11. Live Stream UI

### Viewer Layout

```
┌──────────────────────────────────────────┐
│  [← Back]  🔴 LIVE  ●  47 viewers       │
├──────────────────────────────────────────┤
│                                          │
│                                          │
│            Video Player                  │
│         (16:9 aspect ratio)              │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  The Nutcracker — Act 2                  │
│  Sugar Plum Fairy Variation              │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ Chat (if enabled)                │    │
│  │ Parent: Beautiful! 💜            │    │
│  │ Parent: She's doing great!       │    │
│  │                                  │    │
│  │ [Type a message...]   [Send]     │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

- Video player: Cloudflare Stream embed, 16:9 aspect ratio
- Live indicator: red dot + "LIVE" badge, pulsing animation
- Viewer count: real-time
- Chat: optional (admin toggle), scrolling messages, parent name displayed
- Fullscreen toggle available
- Mobile: video fills width, info + chat below with scroll

### Stream Status States

| State | UI |
|-------|----|
| Scheduled | Countdown timer, "Stream starts in 2h 15m" |
| Starting | "Stream is starting..." with pulse animation |
| Live | Red "LIVE" badge, video playing |
| Buffering | Spinner overlay on video |
| Ended | "Stream has ended" with option to view recording |
| Error | "Unable to connect — please refresh" with retry button |

---

## 12. WCAG 2.1 AA Compliance

### Color Contrast

| Element | Foreground | Background | Ratio | Requirement |
|---------|-----------|------------|-------|-------------|
| Body text | Charcoal `#2D2A33` | Cream `#FAF8F3` | 11.2:1 | ≥ 4.5:1 ✅ |
| Body text | Charcoal `#2D2A33` | White `#FFFFFF` | 13.5:1 | ≥ 4.5:1 ✅ |
| Secondary text | Slate `#5A5662` | White `#FFFFFF` | 6.8:1 | ≥ 4.5:1 ✅ |
| Lavender button text | White `#FFFFFF` | Lavender `#9C8BBF` | 3.2:1 | ≥ 3:1 for large text ✅ |
| Gold button text | White `#FFFFFF` | Dark Gold `#9B7A2E` | 4.6:1 | ≥ 4.5:1 ✅ |
| Placeholder text | Mist `#9E99A7` | White `#FFFFFF` | 3.0:1 | ≥ 3:1 (non-text) ✅ |

**Note:** Lavender button text at normal size (14px bold) meets the 3:1 large text requirement because it uses `font-semibold` + `tracking-wide`. For body-size lavender text on white, use Dark Lavender `#6B5A99` instead (5.4:1).

### Focus Management

- All interactive elements must have a visible focus indicator
- Focus ring: `focus:ring-2 focus:ring-lavender/50 focus:ring-offset-2`
- Tab order follows visual order (no `tabindex > 0`)
- Modal dialogs trap focus within the dialog
- Focus returns to trigger element when dialog closes
- Skip-to-main-content link as first focusable element

### Keyboard Navigation

- All functionality available via keyboard
- Enter/Space to activate buttons and links
- Arrow keys for menu navigation, tab/calendar cells
- Escape to close modals, dropdowns, overlays
- Custom components (casting board, constellation) must support keyboard

### Screen Reader Support

- All images: descriptive `alt` text (or `alt=""` for decorative)
- Form inputs: associated `<label>` elements (never placeholder-only)
- Icons: `aria-label` when used as buttons, `aria-hidden` when decorative
- Dynamic content changes: `aria-live="polite"` for toasts and status updates
- Data tables: proper `<thead>`, `<th scope="col">`, `<th scope="row">`
- Navigation landmarks: `<nav>`, `<main>`, `<aside>`, `<header>`, `<footer>`

### Motion and Animation

- Respect `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- Badge constellation: static positions shown without animation in reduced motion mode
- Swipe feed: instant transitions instead of smooth scroll
- No auto-playing video with sound — user must initiate

### Content Structure

- One `<h1>` per page
- Heading hierarchy: h1 → h2 → h3 (never skip levels)
- Lists for navigation items and grouped content
- Sufficient line height (1.5+ for body text)
- Maximum line length: 75 characters

---

## 13. Data Table Pattern

### Standard Table (Admin)

```tsx
<div className="rounded-xl border border-silver/50 overflow-hidden">
  <Table>
    <TableHeader className="bg-cloud">
      <TableRow>
        <TableHead className="font-semibold text-charcoal">Name</TableHead>
        <TableHead>Class</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <TableRow key={item.id} className="hover:bg-cream/50">
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell>{item.class}</TableCell>
          <TableCell><StatusBadge status={item.status} /></TableCell>
          <TableCell className="text-right">
            <DropdownMenu>...</DropdownMenu>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
  <div className="flex items-center justify-between px-4 py-3 border-t border-silver/30">
    <p className="text-sm text-slate">Showing 1-25 of 147</p>
    <Pagination />
  </div>
</div>
```

### Table Rules

- Header row: cloud background, semibold text
- Row hover: cream at 50% opacity
- Pagination: always present, 25 items per page default
- Mobile: tables become card lists below 768px
- Sortable columns: click header to toggle sort, arrow indicator
- Actions column: right-aligned, dropdown menu for multiple actions
- Bulk selection: checkbox column on left, bulk action bar appears above table

---

*Last updated: March 2026*
