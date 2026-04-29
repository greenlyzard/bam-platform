> 🌐 **Public WordPress Website Only**
>
> This document describes the styling for the public marketing website 
> at `balletacademyandmovement.com` — built on Flatsome (WordPress).
>
> This is **NOT** the spec for the portal application 
> (`portal.balletacademyandmovement.com`). The portal uses different 
> colors (lavender `#9C8BBF` not `#b4a7d6`), different fonts (Montserrat 
> + Cormorant Garamond, not the Flatsome stack), and different patterns.
>
> **For portal styling:** see `docs/UI_STYLE_DIRECTIVES.md`.
>
> The website and the portal are intentionally separate visual systems. 
> If a future decision unifies them, that's a new spec. Until then, treat 
> them as distinct.

---

# BAM Website Theme Settings
## Flatsome 3.20.5 — balletacademyandmovement.com
### Master Reference for All Page Builds

> **This is the single source of truth for all web pages built for Ballet Academy and Movement.**
> Claude Code must load this file at the start of any page build task.

---

## 1. Flatsome Version & Stack

| Item | Value |
|------|-------|
| Theme | Flatsome |
| Version | 3.20.5 |
| CMS | WordPress |
| Page builder | UX Builder (shortcodes) |
| Domain | balletacademyandmovement.com |
| Custom CSS location | Appearance → Customize → Style → Custom CSS |

---

## 2. Typography

### Font Stack

| Role | Font | Class / Selector |
|------|------|-----------------|
| Headings (H1–H6) | Montserrat | `h1,h2,h3,h4,h5,h6, .heading-font` |
| Body text | Montserrat | `body` |
| Navigation | Montserrat | `.nav > li > a` |
| Accent / Tagline | Dancing Script | `.alt-font` |

### Font Override CSS (Custom CSS block)
```css
body {
  font-family: "Montserrat", sans-serif;
}
h1, h2, h3, h4, h5, h6, .heading-font {
  font-family: "Montserrat", sans-serif;
}
.nav > li > a {
  font-family: "Montserrat", sans-serif;
}
.alt-font {
  font-family: "Dancing Script", cursive;
}
```

### Google Fonts Import (for standalone HTML pages)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&display=swap" rel="stylesheet">
```

### Typography Usage Patterns (from live site)
- `"Welcome to"` tagline → `.alt-font` → Dancing Script
- `"Ballet Academy & Movement"` title → H1/H2 → Montserrat
- `"Where Passion and Purpose..."` subtitle → H3 → Montserrat
- Body copy → Montserrat Regular (400)
- Button text → Montserrat Medium (500) or SemiBold (600)
- Breadcrumbs → Montserrat UPPERCASE

---

## 3. Color Palette

### Primary Brand Colors — CONFIRMED FROM FLATSOME THEME OPTIONS

| Flatsome Setting | Color Name | Hex | Usage |
|-----------------|------------|-----|-------|
| **Primary Color** | Lavender | `#b4a7d6` | Primary buttons, hero bg, icons, links |
| **Secondary Color** | Soft Pink | `#f4b0d5` | Secondary buttons, accent elements |
| **Success Color** | Blush / Cream Rose | `#f1e1dd` | Success states, light section backgrounds |
| **Alert Color** | Hot Pink | `#e173a8` | Alert messages, sale badges, accents |
| **Base Text Color** | Medium Gray | `#555555` | All body text |
| **Headline Color** | Medium Gray | `#555555` | H1–H6 default (overridden per section) |
| **White** | White | `#ffffff` | Text on dark/colored backgrounds |

### Extended Palette (derived / accent)

| Color Name | Hex | Usage |
|------------|-----|-------|
| **Lavender Dark** | `#9b8fca` | Hover on primary, footer bg |
| **Lavender Deeper** | `#7a6ab0` | Active states, strong contrast |
| **Cream / Off-White** | `#faf8f3` | Page background, light sections |
| **Gold** | `#c9a84c` | Award highlights, accent text |
| **Gold Dark** | `#9b7a2e` | Gold hover states |

### CSS Custom Properties — Copy/Paste Block for All Pages
```css
:root {
  /* Flatsome Theme Colors — confirmed March 2026 */
  --color-primary: #b4a7d6;
  --color-primary-dark: #9b8fca;
  --color-primary-deeper: #7a6ab0;
  --color-secondary: #f4b0d5;
  --color-success: #f1e1dd;
  --color-alert: #e173a8;
  --color-text: #555555;
  --color-text-dark: #333333;
  --color-white: #ffffff;
  --color-cream: #faf8f3;
  --color-gold: #c9a84c;
  --color-gold-dark: #9b7a2e;
}
```

---

## 4. Button Styles

### Flatsome Button Classes

| Variant | Flatsome HTML | Visual |
|---------|---------------|--------|
| Primary filled | `<a class="button primary">CTA</a>` | Lavender bg, white text |
| Secondary filled | `<a class="button secondary">CTA</a>` | Pink/salmon bg, white text |
| Primary outline | `<a class="button primary is-outline">CTA</a>` | Lavender border, lavender text |
| White outline | `<a class="button white is-outline">CTA</a>` | White border, white text (on dark bg) |
| Large primary | `<a class="button primary large">CTA</a>` | Large lavender button |

### Button CSS (for standalone HTML pages)
```css
.btn-primary {
  background-color: var(--color-primary); /* #b4a7d6 */
  color: #fff;
  border: 2px solid var(--color-primary);
  padding: 12px 28px;
  font-family: "Montserrat", sans-serif;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  display: inline-block;
  transition: background 0.2s, color 0.2s;
}
.btn-primary:hover {
  background-color: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}
.btn-outline {
  background-color: transparent;
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
  padding: 12px 28px;
  font-family: "Montserrat", sans-serif;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  display: inline-block;
  transition: background 0.2s, color 0.2s;
}
.btn-outline:hover {
  background-color: var(--color-primary);
  color: #fff;
}
.btn-white-outline {
  background-color: transparent;
  color: #fff;
  border: 2px solid #fff;
  padding: 12px 28px;
  font-family: "Montserrat", sans-serif;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  display: inline-block;
  transition: background 0.2s, color 0.2s;
}
.btn-white-outline:hover {
  background-color: rgba(255,255,255,0.15);
}
```

---

## 5. Flatsome UX Builder Shortcode Reference

### Layout Shortcodes
```
[section bg="#9C8BBF" padding="60px" text_color="light"]
  [row]
    [col span="12" span__sm="12"]
      Content here
    [/col]
  [/row]
[/section]
```

### Column Spans (12-column grid)
| Class / span | Width |
|-------------|-------|
| `span="12"` | Full width |
| `span="6"` | Half (2-col) |
| `span="4"` | Third (3-col) |
| `span="3"` | Quarter (4-col) |
| `span__sm="12"` | Full width on mobile |
| `span__sm="6"` | Half on mobile |

### Common Section Types Used on BAM Site
```
/* Hero section */
[section padding="60px 0px" bg_color="#9C8BBF" text_color="light"]

/* Cream/light section */
[section padding="60px 0px" bg_color="#FAF8F3"]

/* Dark lavender section */
[section padding="60px 0px" bg_color="#6B5A99" text_color="light"]

/* White section */
[section padding="60px 0px"]
```

### Title / Heading Shortcode
```
[title style="center" size="large"]Your Heading Here[/title]
[title style="center" size="medium" sub="Subtitle text here"]Main Heading[/title]
```

### Button Shortcode
```
[button text="Schedule a Free Trial" link="/new-students/" style="primary" size="normal"]
[button text="Learn More" link="/about/" style="outline" size="normal"]
[button text="Register Now" link="https://app.gostudiopro.com/online/balletacademymovement" style="primary" size="large"]
```

### Gap / Divider
```
[gap height="20px"]
[gap height="40px"]
[divider width="60px" color="#9C8BBF"]
```

---

## 6. Layout & Spacing Conventions

### Container Width
- Max width: **1200px** (Flatsome default)
- Content padding: **20px** left/right on mobile

### Section Padding (from live site)
- Standard section: `padding: 60px 0`
- Compact section: `padding: 40px 0`
- Hero section: `padding: 80px 0` or `padding: 100px 0`
- Mobile: reduce by ~40%

### Heading Size Scale
```css
h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 400; }
h2 { font-size: clamp(1.5rem, 3vw, 2.5rem); font-weight: 400; }
h3 { font-size: clamp(1.1rem, 2vw, 1.5rem); font-weight: 600; }
h4 { font-size: 1.1rem; font-weight: 600; }
h5 { font-size: 0.95rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
h6 { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; }
```

---

## 7. Page Structure Template

Every BAM landing page follows this structure:

```
1. [HERO]         — Full-width, lavender background, H1 + tagline + CTA buttons
2. [ABOUT]        — Amanda Cobb credentials, awards callout
3. [PROGRAMS]     — Ballet first, then Jazz/Contemporary/Musical Theatre
4. [CREDENTIALS]  — 4x Best Dance School, Hall of Fame, Royal Ballet/ABT/Stuttgart
5. [WHY CHOOSE]   — Small classes, nurturing culture, professional faculty
6. [TESTIMONIALS] — Parent quotes
7. [FAQ]          — Accordion with FAQPage schema
8. [LOCATION]     — Google Maps embed + address + hours
9. [CTA FOOTER]   — Free trial CTA, registration link
```

---

## 8. Page-Specific SEO Template

For local SEO landing pages, include this in `<head>`:

```html
<!-- LocalBusiness Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "DanceSchool",
  "name": "Ballet Academy and Movement",
  "description": "Classical ballet and dance classes for ages 3-adult in San Clemente, CA.",
  "url": "https://balletacademyandmovement.com",
  "telephone": "(949) 229-0846",
  "email": "dance@bamsocal.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "400-C Camino De Estrella",
    "addressLocality": "San Clemente",
    "addressRegion": "CA",
    "postalCode": "92672",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 33.4269,
    "longitude": -117.6119
  },
  "openingHours": ["Mo-Fr 09:00-20:00", "Sa 09:00-17:00"],
  "priceRange": "$$",
  "image": "https://balletacademyandmovement.com/wp-content/uploads/2024/06/BAM-Logos_Text-Only_Gray_Gray-Outline.png",
  "sameAs": [
    "https://www.facebook.com/BalletAcademyMovement",
    "https://www.instagram.com/balletacademymovement/"
  ]
}
</script>
```

---

## 9. Standard Meta Tags Template

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ballet Classes in [CITY] CA | Ballet Academy and Movement</title>
<meta name="description" content="Classical ballet and dance classes for children ages 3–12 in [CITY], CA. Small classes, professional faculty, nurturing environment. Free trial class available.">
<link rel="canonical" href="https://balletacademyandmovement.com/[SLUG]">
<meta property="og:title" content="Ballet Classes in [CITY] CA | Ballet Academy and Movement">
<meta property="og:description" content="Award-winning ballet studio in South Orange County. 4x Best Dance School. Royal Ballet, ABT & Stuttgart alumni.">
<meta property="og:url" content="https://balletacademyandmovement.com/[SLUG]">
<meta property="og:type" content="website">
```

---

## 10. Studio Information Block

Use this exact block in all pages — never vary these details:

```
Studio Name:    Ballet Academy and Movement
Founder:        Amanda Cobb (former professional ballerina)
Address:        400-C Camino De Estrella, San Clemente, CA 92672
Phone:          (949) 229-0846
Email:          dance@bamsocal.com
Website:        balletacademyandmovement.com
Registration:   https://app.gostudiopro.com/online/balletacademymovement

Awards:
  - 4x Best Dance School, San Clemente (2022, 2023, 2024 + People's Choice)
  - San Clemente Hall of Fame
  - People's Choice Awards 2023, 2024, 2025

Intensive Placements:
  - Royal Ballet (London) — 2024
  - American Ballet Theatre (NYC) — 2023
  - Stuttgart Ballet (Germany) — 2022
  - Ballet West — 2022, 2026
  - BYU — 2024
  - Miami City Ballet — 2026

Programs:
  Ballet: Petites (3–5), Level 1 (4–6), Level 2 (6–8), Level 3 (9–11), Level 4 (12+), Adult
  Other:  Jazz, Contemporary/Lyrical, Tap, Hip Hop, Musical Theater, Dance Team
  Specialty: Company, Competition Team, Pilates, Gyrotonic, Cheer, Privates

Social:
  Instagram: https://www.instagram.com/balletacademymovement/
  Facebook:  https://www.facebook.com/BalletAcademyMovement
  TikTok:    https://www.tiktok.com/@balletacademymovement
  YouTube:   https://www.youtube.com/@balletacademymovement
```

---

## 11. Tone & Copy Guidelines

### Voice
- Warm, refined, encouraging, knowledgeable
- Avoid: corporate language, excessive exclamation points, generic dance studio copy
- Lead with: credentials, culture, and results — not price or availability

### Key Messages (use in every page)
1. "Real ballet training in a nurturing environment"
2. Small class sizes (max 10 students per class)
3. Founded and staffed by former professional dancers
4. Award-winning — 4x Best Dance School in San Clemente
5. Students accepted to Royal Ballet, ABT, Stuttgart Ballet intensives

### Avoid Positioning As
- Competition dance factory
- Recreational/hobby dance
- Generic "fun dance classes"

### Lead CTA
Always use: **"Schedule a Free Trial Class"** → links to `/new-students/` or Studio Pro registration

---

## 12. Known CSS Overrides

The Flatsome Custom CSS field is currently **empty** — all styling comes through Theme Options settings. Any future Custom CSS additions should be documented here.

```css
/* Add future custom CSS overrides here */
/* Example: */
/* .page-id-123 .hero-section { padding: 120px 0; } */
```

---

## 13. File Naming Conventions

| Page Type | Slug Pattern | Example |
|-----------|-------------|---------|
| Local SEO | `ballet-classes-[city]` | `ballet-classes-san-clemente` |
| Program page | `[program-name]` | `ballet`, `jazz`, `petites` |
| Info page | descriptive slug | `new-students`, `about`, `faq` |
| Event page | `[year]-[event-name]` | `2026-san-juan-hills-sylvia` |

---

*Last updated: March 2026*
*Maintained by: Derek Shaw / Claude Code*
*Source: Live site inspection + Flatsome 3.20.5 documentation*
