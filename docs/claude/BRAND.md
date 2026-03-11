# BRAND.md — Ballet Academy and Movement Brand System

> Design and communication guidelines for every interface, email, and page in the BAM Platform.

---

## 1. Studio Identity

**Full name:** Ballet Academy and Movement
**Never abbreviate publicly as:** BAM (trademark conflict — internal/code use only)
**Founder:** Amanda Cobb — former professional ballerina
**Tagline:** Real ballet training in a nurturing environment.
**Location:** 400-C Camino De Estrella, San Clemente, CA 92672

---

## 2. Color Palette

### Primary Colors

| Name | Hex | CSS Variable | Usage |
|------|-----|-------------|-------|
| Lavender | `#9C8BBF` | `--color-lavender` | Primary brand, buttons, headings, nav active states |
| Dark Lavender | `#6B5A99` | `--color-lavender-dark` | Hover states, focus rings, emphasis |
| Light Lavender | `#C4B8D9` | `--color-lavender-light` | Backgrounds, badges, tags |
| Cream | `#FAF8F3` | `--color-cream` | Page backgrounds, card surfaces |
| Warm White | `#FEFDFB` | `--color-warm-white` | Alternate section backgrounds |
| Gold | `#C9A84C` | `--color-gold` | Accents, achievements, premium features, CTAs |
| Dark Gold | `#9B7A2E` | `--color-gold-dark` | Gold hover states, active medals |
| Light Gold | `#E8D9A0` | `--color-gold-light` | Badge backgrounds, highlight rows |

### Neutral Colors

| Name | Hex | CSS Variable | Usage |
|------|-----|-------------|-------|
| Charcoal | `#2D2A33` | `--color-charcoal` | Body text, headings |
| Slate | `#5A5662` | `--color-slate` | Secondary text, captions |
| Mist | `#9E99A7` | `--color-mist` | Placeholder text, disabled states |
| Silver | `#D4D1D8` | `--color-silver` | Borders, dividers |
| Cloud | `#F0EDF3` | `--color-cloud` | Input backgrounds, subtle surfaces |

### Semantic Colors

| Name | Hex | CSS Variable | Usage |
|------|-----|-------------|-------|
| Success | `#5A9E6F` | `--color-success` | Confirmations, enrolled status |
| Warning | `#D4A843` | `--color-warning` | Attention needed, approaching capacity |
| Error | `#C45B5B` | `--color-error` | Validation errors, overdue payments |
| Info | `#6B8FC4` | `--color-info` | Informational banners, tips |

### Sub-Brand Palettes

| Program | Primary | Accent | CSS Prefix |
|---------|---------|--------|-----------|
| All Students (BAM) | Lavender `#9C8BBF` | Gold `#C9A84C` | `--brand-bam-` |
| Recreational / Petite | Soft Blue `#8BAFC4` | Cream `#FAF8F3` | `--brand-rec-` |
| Performance Company | Lavender `#9C8BBF` | Dark Lavender `#6B5A99` | `--brand-perf-` |
| Competition Company | Charcoal `#2D2A33` | Gold `#C9A84C` | `--brand-comp-` |

### CSS Variables Block

```css
:root {
  /* Primary */
  --color-lavender: #9C8BBF;
  --color-lavender-dark: #6B5A99;
  --color-lavender-light: #C4B8D9;
  --color-cream: #FAF8F3;
  --color-warm-white: #FEFDFB;
  --color-gold: #C9A84C;
  --color-gold-dark: #9B7A2E;
  --color-gold-light: #E8D9A0;

  /* Neutrals */
  --color-charcoal: #2D2A33;
  --color-slate: #5A5662;
  --color-mist: #9E99A7;
  --color-silver: #D4D1D8;
  --color-cloud: #F0EDF3;

  /* Semantic */
  --color-success: #5A9E6F;
  --color-warning: #D4A843;
  --color-error: #C45B5B;
  --color-info: #6B8FC4;

  /* Surfaces */
  --surface-page: var(--color-cream);
  --surface-card: #FFFFFF;
  --surface-elevated: #FFFFFF;
  --surface-overlay: rgba(45, 42, 51, 0.5);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(45, 42, 51, 0.06);
  --shadow-md: 0 4px 12px rgba(45, 42, 51, 0.08);
  --shadow-lg: 0 8px 24px rgba(45, 42, 51, 0.12);
  --shadow-gold: 0 4px 16px rgba(201, 168, 76, 0.2);
}
```

---

## 3. Typography

### Font Stack

| Role | Font | Weight | CSS Variable |
|------|------|--------|-------------|
| Headings | Cormorant Garamond | 500, 600, 700 | `--font-heading` |
| Body / UI | Nunito | 400, 500, 600, 700 | `--font-body` |
| Monospace (code/data) | JetBrains Mono | 400 | `--font-mono` |

### Type Scale

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|---------------|
| Display | 3rem (48px) | Cormorant 700 | 1.1 | -0.02em |
| H1 | 2.25rem (36px) | Cormorant 600 | 1.2 | -0.01em |
| H2 | 1.75rem (28px) | Cormorant 600 | 1.25 | -0.01em |
| H3 | 1.375rem (22px) | Cormorant 500 | 1.3 | 0 |
| H4 | 1.125rem (18px) | Nunito 600 | 1.4 | 0 |
| Body | 1rem (16px) | Nunito 400 | 1.6 | 0 |
| Body Small | 0.875rem (14px) | Nunito 400 | 1.5 | 0 |
| Caption | 0.75rem (12px) | Nunito 500 | 1.4 | 0.02em |
| Button | 0.875rem (14px) | Nunito 600 | 1 | 0.03em |

### CSS Variables

```css
:root {
  --font-heading: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
  --font-body: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### Typography Rules

- **Headings** always use Cormorant Garamond — this is the signature of the brand
- **Never use all-caps** for headings — it conflicts with the refined aesthetic
- Buttons and labels use Nunito semibold with slight letter-spacing
- Body text minimum 16px on all devices — no exceptions
- Line length: max 65–75 characters for readability

---

## 4. Tone of Voice

### Core Voice Attributes

| Attribute | What it means | What it is NOT |
|-----------|--------------|----------------|
| **Warm** | Welcoming, approachable, feels like a conversation with a trusted mentor | Stiff, formal, institutional |
| **Refined** | Polished language, attention to detail, respects the art form | Pretentious, elitist, exclusionary |
| **Encouraging** | Celebrates effort and growth, not just achievement | Pushy, competitive, comparative |
| **Knowledgeable** | Speaks from genuine expertise in classical ballet pedagogy | Condescending, jargon-heavy, academic |

### Voice Guardrails

**Never sound:**
- Corporate or SaaS-like ("optimize your workflow", "streamline operations")
- Generic fitness/gym ("crush your goals", "no pain no gain")
- Childish or patronizing (excessive exclamation marks, baby talk)
- Competitive or aggressive ("beat the competition", "dominate")
- Sales-pushy ("limited time offer!", "don't miss out!!!")

**Always sound like:**
- A knowledgeable ballet instructor who genuinely cares about each child
- A trusted friend who happens to run a beautiful studio
- Someone who takes the art seriously but doesn't take themselves too seriously

### Writing Rules

1. Lead with the student experience, not the studio's credentials
2. Use "your child" or the student's name — never "clients" or "customers"
3. Refer to classes as "classes" — never "sessions" or "bookings" in parent-facing copy
4. Say "families" — never "users" or "accounts"
5. Performances are "shows" or "performances" — never "events" or "recitals" (unless it specifically is a recital)
6. Tuition is "tuition" — never "subscription" or "membership fee"
7. Use active voice: "Your child will learn" not "Skills will be developed"

---

## 5. Age-Specific Voice Guidelines

### Parents of Ages 3–5 (Petite / Early Childhood)

**Tone:** Gentle, reassuring, joyful
**Focus:** First experiences, comfort, play-based learning, building confidence

> **Do:** "Watch your little one discover the magic of movement in a safe, joyful space."
> **Don't:** "Enroll your toddler in our pre-ballet program to develop foundational motor skills."

**Key words:** discover, explore, imagine, first steps, magical, joyful, safe, nurturing
**Avoid:** curriculum, technique, assessment, training, rigor

### Parents of Ages 6–9 (Beginner / Intermediate)

**Tone:** Enthusiastic, supportive, growth-oriented
**Focus:** Building skills, making friends, falling in love with ballet, developing discipline

> **Do:** "This is where the love of ballet really takes root — your child will grow in confidence, grace, and friendship."
> **Don't:** "Students at this level will master barre fundamentals and begin center work progressions."

**Key words:** grow, build, friendships, confidence, grace, dedication, love of dance
**Avoid:** Overly technical terminology without context, competitive framing

### Parents of Ages 10–12 (Intermediate / Pre-Professional)

**Tone:** Respectful, motivating, acknowledging their growing independence
**Focus:** Artistic development, preparation for performance, personal growth, future opportunities

> **Do:** "Your dancer is developing real artistry — we'll challenge them with roles that match their growing abilities."
> **Don't:** "Our advanced track feeds directly into pre-professional programs and summer intensives."

**Key words:** artistry, challenge, growth, dedication, performance, craft, potential
**Avoid:** Pressure language, comparison to other students, implied career expectations

### Teacher-Facing Copy

**Tone:** Professional, collegial, respectful of expertise
**Focus:** Pedagogy, studio culture, collaboration, professional development

> **Do:** "You'll join a team of dedicated artists who believe every student deserves excellent instruction."
> **Don't:** "We need energetic team players who can deliver results in a fast-paced environment."

**Key words:** pedagogy, artistry, mentorship, collaboration, classical training, nurturing
**Avoid:** Corporate HR language, "team player", "fast-paced", "competitive compensation"

### Student-Facing Copy (Ages 10+)

**Tone:** Direct, encouraging, treats them as young artists
**Focus:** Their progress, upcoming roles, schedule, personal achievements

> **Do:** "You've been cast as Clara — rehearsals start Thursday. Check your schedule for times."
> **Don't:** "Congratulations!!! 🎉 You got the part!! So exciting!! 🩰✨"

**Key words:** your role, your schedule, rehearsal, performance, practice, your progress
**Avoid:** Talking down, excessive enthusiasm, emojis in formal communications

---

## 6. Imagery and Photography

### Photo Style

- Natural light preferred — warm, golden tones
- Candid moments of learning, not just posed performance
- Show the relationship between teacher and student
- Include diverse body types and backgrounds naturally
- Studio environment should feel clean, light, spacious

### Photo Rules

- Never use stock photos of dancers — always real BAM students (with media release)
- Performance photos: credit photographer always
- Social media: maintain the warm/refined aesthetic — no heavy filters or meme formats
- Headshots for staff: consistent style, neutral background, professional but approachable

### Illustration and Graphics

- Minimal line art if needed — no cartoonish graphics
- Icons: simple, single-weight line style (Lucide icon set matches well)
- No clipart, no generic dance silhouettes, no tutu illustrations
- Decorative elements: subtle gold lines, lavender washes, elegant curves

---

## 7. Logo and Naming Usage

- **Full name in all public-facing contexts:** Ballet Academy and Movement
- **Acceptable shorthand in internal/staff UI:** BAM (e.g., sidebar label, admin header)
- **Never in parent-facing copy:** BAM, B.A.M., or any abbreviation
- Logo must have minimum clear space equal to the height of the "B"
- Logo on dark backgrounds: use white or cream variant
- Logo on light backgrounds: use lavender or charcoal variant
- Minimum logo size: 120px wide on web, 1 inch in print

---

## 8. Email and Communication Templates

### Email Design

- Header: Studio logo on cream background
- Body: White card on cream background, Nunito body text
- CTAs: Lavender button with white text, rounded corners (8px)
- Footer: Studio address, phone, unsubscribe link
- Max width: 600px

### Subject Line Voice

- Informational: "Your fall schedule is ready"
- Reminder: "Rehearsal tomorrow at 4:30 PM — Act 2 cast"
- Celebration: "New badge earned: First Pointe Class"
- Billing: "October tuition — payment received"

**Never:** ALL CAPS subjects, excessive punctuation, clickbait, emoji spam

---

*Last updated: March 2026*
