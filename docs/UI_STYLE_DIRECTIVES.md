# UI Style Directives — BAM Portal App

**Scope:** This document covers the **portal application** — everything served from `portal.balletacademyandmovement.com` (Next.js app under `app/(admin)`, `app/(portal)`, `app/(teach)`, etc.).

**This is NOT for:** the public WordPress site at `balletacademyandmovement.com`. That uses a different theme (Flatsome), a different lavender, and different fonts. See `docs/brand/website-theme-settings.md` for the website.

**Authority:** This is the canonical source of truth for all visual decisions in the portal. When this doc and any other doc (including `BRAND.md`, the deprecated `brand/brand-guidelines.md`, or older specs) disagree about portal styling, this doc wins.

---

## The 30-second rule

If you only have 30 seconds before building something for the portal, you need to know:

| | |
|---|---|
| **Primary lavender** | `#9C8BBF` |
| **Cream background** | `#FAF8F3` |
| **Gold accent** | `#C9A84C` |
| **Body text** | `#2C2C2C` (charcoal) |
| **Heading font** | Cormorant Garamond (light/regular weights) |
| **Body/UI font** | Montserrat (400/500/600 weights) |
| **Primary button** | Pill shape, 5px radius, lavender background, white text |
| **Dropdowns** | Always `SimpleSelect` from `components/ui/select.tsx` — never native `<select>` in client components |
| **Aesthetic** | Minimal luxury ballet studio. Generous whitespace. Thin borders. Soft shadows. No gradients, no chunky elements, no Bootstrap look. |

---

## Color tokens

These are the canonical hex values for the portal. They map to CSS variables / Tailwind utilities defined in the codebase.

### Primary

| Name | Hex | Usage |
|---|---|---|
| Lavender | `#9C8BBF` | Primary brand color — buttons, accents, focus rings, active nav |
| Lavender Dark | `#6B5A99` | Hover state for primary lavender, active emphasis |
| Lavender Light | `#C5B8E0` | Subtle backgrounds, disabled-but-active states |
| Lavender Pale | `#F0EBF8` | Card backgrounds, skeleton loaders, soft fills |

### Neutrals

| Name | Hex | Usage |
|---|---|---|
| Cream | `#FAF8F3` | Page backgrounds — the warm tone that makes the portal feel like the studio, not a SaaS dashboard |
| Ivory | `#F5F0E8` | Card backgrounds when cream feels too light against page |
| Warm White | `#FFFDF9` | Input backgrounds — the slight warmth distinguishes from pure white |
| White | `#FFFFFF` | Use sparingly. Only when cream is too warm for the context (e.g., on top of a lavender section). |
| Charcoal | `#2C2C2C` | Body text, dark backgrounds |
| Slate | `#6B6B7B` | Secondary text, captions, helper text |
| Mist | `#A8A8B8` | Placeholder text, disabled text |
| Silver | `#E8E0F0` | Input borders (default state), light dividers |
| Light Gray | `#E8E4DC` | Section dividers, subtle backgrounds |

### Accent

| Name | Hex | Usage |
|---|---|---|
| Gold | `#C9A84C` | Awards, achievements, badges, credential callouts. Never use as a generic CTA — gold is for emphasis, not volume. |
| Gold Dark | `#9B7A2E` | Gold hover state, gold text on light backgrounds |
| Gold Pale | `#FBF3DC` | Achievement badge backgrounds, soft gold tints |

### Status colors

The portal uses softened status colors — never the saturated default red/green/yellow you'd see in a generic SaaS app.

| Name | Hex | Usage |
|---|---|---|
| Success | `#7BAE8C` | Soft sage green — success states, confirmations |
| Warning | `#D4956A` | Warm amber — warnings, payment due |
| Error | `#C47A7A` | Soft rose red — errors, validation failures, destructive actions |
| Info | `#7A9EC4` | Soft blue — informational toasts |

### Sub-brand accents

The portal supports three programs that have distinct accent colors when context requires it. The default (when no sub-brand context is active) is the master lavender.

| Program | Accent | Hex |
|---|---|---|
| Recreational | Soft Blue | `#8BB4C8` |
| Performance Company | Lavender (master) | `#9C8BBF` |
| Competition Company | Black + Gold | `#1A1A1A` + `#C9A84C` |

---

## Typography

### Fonts

**Heading font: Cormorant Garamond** (Google Fonts, free)
- Weights used: 300 (light) and 400 (regular)
- Use for: page titles, section headings, performance program names, display text
- Light (300) for elegant display contexts; regular (400) for smaller headings where readability matters more than elegance

**Body / UI font: Montserrat** (Google Fonts, free)
- Weights used: 400, 500, 600
- Use for: everything else — body text, navigation, buttons, form labels, captions
- Clean geometric sans-serif. High readability at small sizes.

> Montserrat is the canonical body font for the portal. Earlier docs sometimes mention Inter — that's an artifact of an older draft. Inter is not used in the portal.

**Monospace: JetBrains Mono** (Google Fonts, free)
- Use sparingly for: code, IDs, technical data display
- Never use monospace for body copy or UI labels

### Type scale

| Token | Value | Usage |
|---|---|---|
| `text-xs` | 0.75rem (12px) | Labels, badges, metadata |
| `text-sm` | 0.875rem (14px) | Secondary UI, captions, helper text |
| `text-base` | 1rem (16px) | Body. Always 16px+ on input fields to prevent iOS zoom. |
| `text-lg` | 1.125rem (18px) | Card titles, emphasized body |
| `text-xl` | 1.25rem (20px) | Section headings within a card |
| `text-2xl` | 1.5rem (24px) | Page section headings |
| `text-3xl` | 1.875rem (30px) | Module titles |
| `text-4xl` | 2.25rem (36px) | Hero headings |
| `text-5xl` | 3rem (48px) | Display / marketing only |

### Hierarchy in practice

```
H1 — Cormorant Garamond Light, text-4xl/5xl, lavender or charcoal
H2 — Cormorant Garamond Regular, text-3xl, charcoal
H3 — Cormorant Garamond Regular, text-2xl, charcoal
H4 — Montserrat Semibold, text-lg, charcoal
Body — Montserrat Regular, text-base, charcoal
Caption — Montserrat Regular, text-sm, slate
Button — Montserrat Semibold, text-sm/base, white on lavender
```

---

## Buttons

The portal uses **pill-shaped buttons** with a 5px radius — visibly rounded, but not the full pill of `rounded-full`. This matches Amanda's preference for refined-not-aggressive curves.

> Earlier docs disagreed on this: some said `rounded-full` (9999px), some said `4px subtle`. The decision is **5px** — split the difference, keep the pill silhouette without the extreme curve.

### Variants

**Primary** — main CTA, one per view ideally
```
className="bg-lavender text-white rounded-[5px] px-6 py-2.5 
           font-medium hover:bg-lavender-dark transition-colors"
```

**Secondary** — alternative action
```
className="border border-lavender text-lavender rounded-[5px] px-6 py-2.5 
           font-medium hover:bg-lavender/5 transition-colors"
```

**Gold CTA** — high-emphasis action where lavender isn't enough (achievements, milestones)
```
className="bg-gold text-white rounded-[5px] px-6 py-2.5 
           font-medium hover:bg-gold-dark transition-colors"
```

**Ghost** — low-emphasis, often used inline
```
className="text-slate hover:text-charcoal rounded-[5px] px-4 py-2 
           font-medium transition-colors"
```

**Destructive** — only for truly destructive actions (delete student, cancel enrollment)
```
className="bg-error text-white rounded-[5px] px-6 py-2.5 
           font-medium hover:opacity-90 transition-opacity"
```

### Button rules

- One primary button per view. If there are two equally-weighted actions, both are secondary.
- Minimum touch target: 44px height. Don't go smaller, even for inline actions.
- Use `transition-colors` (not `transition-all`) for hover — keeps the animation focused on color change, not layout shift.
- Never use icon-only buttons without an `aria-label`.

### Pills (small inline tags / chips)

For inline tags, badges, and chips, use full pill (`rounded-full`) at smaller sizes:
```
className="text-xs px-3 py-1.5 rounded-full bg-lavender text-white"
```

Outline variant:
```
className="text-xs px-3 py-1.5 rounded-full border border-lavender text-lavender hover:bg-lavender/5"
```

These are different from buttons — pills are tags or chip-style indicators, not action triggers.

---

## Dropdowns

**Rule: always use `SimpleSelect`** from `components/ui/select.tsx` for dropdown selects. It is theme-aware via CSS variables and renders Radix UI internally for accessibility.

```tsx
import { SimpleSelect } from "@/components/ui/select"

<SimpleSelect
  value={value}
  onValueChange={setValue}
  options={[
    { value: "ballet", label: "Ballet" },
    { value: "jazz", label: "Jazz" },
  ]}
  placeholder="Select a discipline"
/>
```

For complex needs (grouped options, custom rendering), use the compound `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` exports from the same file.

### Why this is a hard rule

Native `<select>` elements render the OS default, which on macOS and iOS shows a flat gray dropdown that does not match the portal aesthetic. This has been a recurring drift point — multiple sessions have shipped `<select>` and then had to refactor.

If you find yourself reaching for native `<select>` because of "Radix overhead," stop. The overhead is negligible. Use `SimpleSelect`.

### The one acceptable native-select case

Server-rendered forms (no client interactivity) may use native `<select>` with the standardized class string — this gives an SSR-friendly fallback that still respects the theme:

```
appearance-none bg-white border border-silver rounded-md px-3 py-1.5 
text-sm text-charcoal focus:outline-none focus:border-lavender 
focus:ring-2 focus:ring-lavender/20 cursor-pointer
```

This case is rare. If in doubt, use `SimpleSelect`.

---

## Form inputs

```css
/* Default state */
border: 1px solid #E8E0F0;          /* silver */
border-radius: 8px;
padding: 12px 16px;
background: #FFFDF9;                /* warm white */
font-family: Montserrat;
font-size: 16px;                    /* never below 16px on mobile */

/* Focus */
border-color: #9C8BBF;              /* lavender */
box-shadow: 0 0 0 3px rgba(156, 139, 191, 0.15);

/* Error */
border-color: #C47A7A;              /* error rose */
box-shadow: 0 0 0 3px rgba(196, 122, 122, 0.15);
```

Tailwind equivalent for inputs in client components:
```
className="appearance-none bg-warm-white border border-silver rounded-md 
           px-4 py-3 text-base text-charcoal focus:outline-none 
           focus:border-lavender focus:ring-2 focus:ring-lavender/20"
```

### Input rules

- Labels go **above** inputs, not as placeholders. Placeholders are for example values only.
- Required-field markers use **gold asterisk** (`*` in `text-gold`), never red.
- Error messages appear **below** the input in `text-sm text-error`.
- All inputs are full-width on mobile.
- Date pickers and complex inputs use `shadcn/ui` components, themed to lavender.

---

## Spacing & rhythm

### Radius scale

| Token | Value | Usage |
|---|---|---|
| `rounded-sm` | 4px | Tight elements, badges |
| `rounded-md` | 8px | Inputs, secondary cards |
| `rounded-lg` | 16px | Cards (default) |
| `rounded-xl` | 24px | Large feature cards, modals |
| `rounded-[5px]` | 5px | Buttons (pill-radius) |
| `rounded-full` | 9999px | Chips, avatars, pills |

### Cards

Default card pattern:
```
className="bg-white border border-light-gray rounded-lg p-6 
           shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
```

- White or ivory background (cream is for page backgrounds)
- Soft shadow — barely there. Never the heavy Bootstrap shadow.
- Border is optional; use it on cream backgrounds where the shadow alone isn't enough separation.

### Page layout

- Page backgrounds: cream (`#FAF8F3`)
- Generous padding — `p-6` minimum on cards, `p-8` for spacious content
- Section spacing: `space-y-6` between major sections, `space-y-4` within
- Max content width: usually `max-w-7xl` for admin, `max-w-2xl` for parent portal

---

## Iconography

**Use Lucide React.** Thin outline icons.

- Default stroke: 1.5px (Lucide default)
- Decorative-only: 1px stroke
- Size: 16px for inline UI, 20px for buttons, 24px for nav

**Never:**
- Filled/chunky icons (feel heavy and childish)
- Generic SaaS icons (gear, briefcase, bar chart) in student-facing surfaces
- Emoji in admin/teacher UIs (sparingly OK in student LMS feed only)

For ballet-specific iconography (pointe shoe, tutu, barre), the design considers custom thin-stroke SVGs. These don't exist in the codebase yet — when needed, create them as 1.5px stroke, no fill, lavender or gold tint.

---

## Animation

**Hover transitions: 200ms ease-in-out.** Always use `transition-colors` for color changes; only use `transition-all` when geometry actually changes (rare).

**Loading states:**
- Skeleton loaders for content (lavender-pale `#F0EBF8`, gentle pulse)
- Centered lavender spinner only for full-page blocking loads
- Never block UI for non-critical data — show what you have, fill in async

**Page transitions:** Default Next.js. Don't add custom page-level animation libraries.

---

## What we never do

These are the recurring drift points. If a build looks like any of these, it's wrong.

- **Gray native `<select>` dropdowns.** This is the most-violated rule. Always `SimpleSelect`.
- **Bright primary-color buttons** (saturated blue, red, green). Use lavender or gold.
- **Chunky `rounded-2xl` everywhere.** The portal is refined, not playful.
- **Heavy drop shadows.** The portal uses near-imperceptible shadows. If a shadow looks like Bootstrap, it's wrong.
- **Purple gradients on white.** Generic AI-app aesthetic. Lavender is a solid color, not a gradient.
- **Comic Sans, Roboto, Inter, Arial, system-ui as body font.** Montserrat is the body font.
- **Cartoonish illustrations or emoji-heavy UI.** This is a classical ballet studio, not a kids' activity center.
- **Saturated red/green/yellow status colors.** Use the soft status palette above.
- **Bootstrap-style alert banners.** If you need to alert the user, use a toast or an inline message in the soft status palette.
- **Generic SaaS layouts** (left sidebar nav with all-blue accents). The portal has its own visual language; don't reach for SaaS templates.

---

## Voice (a quick word, since style isn't only visual)

The portal speaks like a former professional ballerina who genuinely loves teaching children — warm, refined, knowledgeable, encouraging. Never corporate. Never cheerleader-y.

Examples:

| Wrong | Right |
|---|---|
| "Sign up today for amazing dance classes!" | "Begin your child's classical ballet journey." |
| "Track your kid's progress with our app!" | "Stay connected to every milestone your dancer reaches." |
| "🎉 Congrats! You earned a badge! 🎉" | "You've mastered your first arabesque. Beautiful work." |

Full voice & tone guidance lives in `docs/BRAND.md` Section 7. This doc just notes that voice is part of style.

---

## When this doc is wrong

If you find a real conflict between this doc and the live codebase, and you're confident the codebase is correct (e.g., a button radius that everyone has been using), update this doc rather than refactoring code. This is a living document and reality wins over spec.

If the conflict is the other way — codebase drifted from this spec — fix the codebase, don't update this doc.

When in doubt, ask Derek.

---

*Last updated: 2026-04-29*  
*Canonical for: portal app (Next.js)*  
*Supersedes the styling sections of: `docs/brand/brand-guidelines.md` (deprecated)*  
*Companion docs: `docs/UX_PATTERNS.md` (component behaviors), `docs/BRAND.md` (brand identity, voice), `docs/brand/website-theme-settings.md` (WordPress site only)*
