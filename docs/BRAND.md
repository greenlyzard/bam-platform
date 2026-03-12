# BAM Platform — Brand Guidelines

## Identity

**Full Name:** Ballet Academy and Movement  
**Do NOT abbreviate publicly as "BAM"** (trademark conflict)  
**Portal name:** BAM Platform (internal/developer use only)  
**Founder:** Amanda Cobb — former professional ballerina  
**Location:** 400-C Camino De Estrella, San Clemente, CA 92672  
**Phone:** (949) 229-0846  
**Email:** dance@bamsocal.com  
**Website:** balletacademyandmovement.com  

---

## Positioning

> "Real ballet training in a nurturing environment."

**Do position as:**
- Classical ballet excellence
- Professional pedagogy
- Nurturing, whole-child development
- Small class sizes with individual attention
- Performance-focused studio (Nutcracker, spring showcase)

**Do NOT position as:**
- Competition dance
- Recreational dance
- Generic activity for kids
- Cartoonish or childish

---

## Visual Identity

### Color Palette

```css
/* Primary */
--bam-lavender:     #9C8BBF;   /* Primary brand color */
--bam-lavender-light: #C5B8E0; /* Hover states, backgrounds */
--bam-lavender-pale:  #F0EBF8; /* Page backgrounds, cards */

/* Neutrals */
--bam-cream:        #FAF7F2;   /* Background */
--bam-ivory:        #F5F0E8;   /* Card backgrounds */
--bam-warm-white:   #FFFDF9;   /* Input backgrounds */

/* Accent */
--bam-gold:         #C9A84C;   /* CTAs, highlights, badges */
--bam-gold-light:   #E8C96A;   /* Hover gold */
--bam-gold-pale:    #FBF3DC;   /* Gold tint backgrounds */

/* Text */
--bam-charcoal:     #2C2C2C;   /* Primary text */
--bam-slate:        #6B6B7B;   /* Secondary text */
--bam-mist:         #A8A8B8;   /* Placeholder, disabled */

/* Status */
--bam-success:      #7BAE8C;   /* Soft sage green */
--bam-warning:      #D4956A;   /* Warm amber */
--bam-error:        #C47A7A;   /* Soft rose red */
--bam-info:         #7A9EC4;   /* Soft blue */
```

### Typography

```css
/* Display / Headlines */
font-family: 'Cormorant Garamond', serif;
/* Use for: hero headings, module titles, performance names */

/* Body / UI */
font-family: 'Montserrat', sans-serif;
/* Use for: body text, buttons, labels, nav — weights 300, 400, 500, 600 */

/* Monospace (data/code only) */
font-family: 'JetBrains Mono', monospace;
```

**Type Scale:**
```css
--text-xs:   0.75rem;   /* Labels, badges */
--text-sm:   0.875rem;  /* Secondary UI, captions */
--text-base: 1rem;      /* Body */
--text-lg:   1.125rem;  /* Card titles */
--text-xl:   1.25rem;   /* Section headings */
--text-2xl:  1.5rem;    /* Page headings */
--text-3xl:  1.875rem;  /* Module titles */
--text-4xl:  2.25rem;   /* Hero headings */
--text-5xl:  3rem;      /* Display / marketing */
```

### Spacing & Radius

```css
--radius-sm:  4px;
--radius-md:  8px;
--radius-lg:  16px;
--radius-xl:  24px;
--radius-full: 9999px;

/* Cards should use --radius-lg or --radius-xl */
/* Buttons: --radius-full for primary, --radius-md for secondary */
/* Inputs: --radius-md */
```

### Iconography

- Use **thin outline** vector icons (Lucide React is preferred)
- Stroke width: 1.5px for UI icons, 1px for decorative
- Never use filled/chunky icons — they feel heavy and childish
- Avoid emoji in UI (use sparingly in student-facing LMS only)

### Imagery Style

- Ultra-realistic circular photography for instructor profiles
- Soft, natural lighting — never harsh flash
- Ballet imagery: pointe shoes, barre, studio light, performance moments
- Never stock-photo-generic dance imagery

---

## UI Aesthetic

**Style:** Minimal luxury ballet studio

**Feel like:** A high-end boutique fitness app crossed with a refined arts institution

**Reference points:** Goop, Alo Yoga, Royal Ballet website — NOT Mindbody, Jackrabbit, or generic SaaS

**Do:**
- Generous whitespace
- Elegant typographic hierarchy
- Subtle hover animations (ease-in-out, 200–300ms)
- Thin borders (1px, low-opacity)
- Layered depth with soft shadows
- Glass morphism sparingly for overlays

**Never:**
- Bright primary-color buttons (use lavender/gold instead)
- Chunky rounded corners on everything
- Drop shadows that look like Bootstrap
- Purple gradients on white (generic AI look)
- Comic Sans, Roboto, Inter, Arial, system-ui
- Anything that looks like a generic SaaS dashboard

---

## Voice & Tone

**Adjectives:** Warm, refined, encouraging, knowledgeable, confident

**Write like:** A former professional ballerina who genuinely loves teaching children and has high standards

**Never write like:** A corporate SaaS product, a cheerleading coach, or a generic activity center

### Examples

❌ "Sign up today for amazing dance classes!"  
✅ "Begin your child's classical ballet journey."

❌ "Track your kid's progress with our app!"  
✅ "Stay connected to every milestone your dancer reaches."

❌ "Congrats! You earned a badge! 🎉🎉🎉"  
✅ "You've mastered your first arabesque. Beautiful work."

---

## Age-Specific Tone Adjustments

| Audience | Tone | Language |
|----------|------|----------|
| Parents (primary) | Refined, reassuring, expert | Complete sentences, no jargon |
| Teachers | Professional, collegial | Precise, ballet terminology OK |
| Students 3–5 | Warm, playful, simple | Short sentences, visual cues |
| Students 6–9 | Encouraging, clear | Slightly more detail |
| Students 10–12 | Respectful, aspirational | Near-adult, technique-focused |
