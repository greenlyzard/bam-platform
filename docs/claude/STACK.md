# STACK.md — BAM Platform Technology Stack & Conventions

> Definitive technical reference for the BAM Platform build.

---

## 1. Core Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js (App Router) | 15+ | SSR, RSC, API routes |
| Language | TypeScript | 5.x (strict mode) | Type safety everywhere |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| UI Components | shadcn/ui | Latest | Accessible, customizable component primitives |
| Database | PostgreSQL | 15+ | Primary data store |
| BaaS | Supabase | Latest | Auth, DB, RLS, storage, realtime |
| ORM | Drizzle ORM | Latest | Type-safe queries, migrations |
| Auth | Supabase Auth | — | Email, magic link, role-based access |
| Payments | Stripe | Latest SDK | Tuition, shop, ticketing |
| Email (transactional) | Resend | Latest SDK | Receipts, confirmations, announcements |
| Email (marketing) | Klaviyo | API v3 | Nurture sequences, newsletters |
| Video/Streaming | Cloudflare Stream | — | LMS video hosting, live streaming |
| File Storage | Supabase Storage | — | Photos, PDFs, documents |
| Deployment | Vercel | — | Next.js hosting, edge functions |
| DNS/CDN | Cloudflare | — | bamsocal.com DNS, caching, security |

---

## 2. Project Folder Structure

```
bam-platform/
├── app/                          # Next.js App Router
│   ├── (public)/                 # Public/marketing pages (no auth)
│   │   ├── page.tsx              # Homepage
│   │   ├── ballet-classes-[city]/# SEO city landing pages
│   │   ├── [style]-classes/      # Style pages
│   │   ├── blog/
│   │   └── layout.tsx
│   │
│   ├── (portal)/                 # Parent + student portal
│   │   ├── portal/
│   │   │   ├── dashboard/
│   │   │   ├── children/
│   │   │   ├── schedule/
│   │   │   ├── billing/
│   │   │   ├── performances/
│   │   │   ├── live/
│   │   │   ├── shop/
│   │   │   ├── messages/
│   │   │   └── learning/
│   │   └── layout.tsx            # Portal shell (sidebar + header)
│   │
│   ├── (teacher)/                # Teacher portal
│   │   ├── teacher/
│   │   │   ├── dashboard/
│   │   │   ├── classes/
│   │   │   ├── attendance/
│   │   │   ├── assessments/
│   │   │   ├── badges/
│   │   │   ├── hours/
│   │   │   ├── content/
│   │   │   └── messages/
│   │   └── layout.tsx            # Teacher shell
│   │
│   ├── (admin)/                  # Admin dashboard
│   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   ├── seasons/
│   │   │   ├── classes/
│   │   │   ├── students/
│   │   │   ├── families/
│   │   │   ├── teachers/
│   │   │   ├── performances/
│   │   │   ├── communications/
│   │   │   ├── billing/
│   │   │   ├── compliance/
│   │   │   ├── content/
│   │   │   ├── expansion/
│   │   │   └── reports/
│   │   └── layout.tsx            # Admin shell
│   │
│   ├── (learn)/                  # LMS / Learning Studio
│   │   ├── learn/
│   │   │   ├── page.tsx          # TikTok-style feed
│   │   │   ├── [content-slug]/
│   │   │   ├── progress/
│   │   │   ├── favorites/
│   │   │   └── live/[session-id]/
│   │   └── layout.tsx            # Minimal chrome for immersive experience
│   │
│   ├── (shop)/                   # Studio Shop (white-label)
│   │   ├── shop/[shop-slug]/
│   │   │   ├── page.tsx          # Product catalog
│   │   │   ├── product/[product-slug]/
│   │   │   ├── cart/
│   │   │   └── checkout/
│   │   └── layout.tsx
│   │
│   ├── (auth)/                   # Auth pages
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── callback/
│   │
│   ├── api/                      # API routes
│   │   ├── students/
│   │   ├── classes/
│   │   ├── enrollments/
│   │   ├── attendance/
│   │   ├── teachers/
│   │   ├── badges/
│   │   ├── assessments/
│   │   ├── performances/
│   │   ├── casting/
│   │   ├── rehearsals/
│   │   ├── content/
│   │   ├── live-sessions/
│   │   ├── shop/
│   │   ├── payments/
│   │   ├── communications/
│   │   ├── webhooks/
│   │   │   ├── stripe/
│   │   │   └── cloudflare-stream/
│   │   └── ai/
│   │
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles + CSS variables
│   └── not-found.tsx
│
├── components/
│   ├── ui/                       # shadcn/ui base components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── table.tsx
│   │   ├── toast.tsx
│   │   ├── skeleton.tsx
│   │   └── ...
│   │
│   ├── studio/                   # BAM-specific components
│   │   ├── casting-board.tsx
│   │   ├── rehearsal-calendar.tsx
│   │   ├── enrollment-wizard.tsx
│   │   ├── class-card.tsx
│   │   ├── student-card.tsx
│   │   ├── attendance-grid.tsx
│   │   ├── badge-constellation.tsx
│   │   ├── swipe-feed.tsx
│   │   ├── live-player.tsx
│   │   ├── shop-product-card.tsx
│   │   ├── schedule-calendar.tsx
│   │   └── kpi-card.tsx
│   │
│   ├── forms/                    # Reusable form components
│   │   ├── student-form.tsx
│   │   ├── class-form.tsx
│   │   ├── enrollment-form.tsx
│   │   └── ...
│   │
│   └── layouts/                  # Shell layouts
│       ├── portal-shell.tsx
│       ├── teacher-shell.tsx
│       ├── admin-shell.tsx
│       ├── public-header.tsx
│       ├── public-footer.tsx
│       └── sidebar-nav.tsx
│
├── lib/
│   ├── db/                       # Drizzle schema + migrations
│   │   ├── schema.ts             # All table definitions
│   │   ├── relations.ts          # Drizzle relations
│   │   ├── client.ts             # DB client singleton
│   │   └── migrations/           # Drizzle migration files
│   │
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   ├── server.ts             # Server Supabase client
│   │   ├── middleware.ts         # Auth middleware
│   │   └── types.ts              # Generated Supabase types
│   │
│   ├── auth/
│   │   ├── config.ts             # Auth configuration
│   │   └── guards.ts             # Role-based route protection
│   │
│   ├── stripe/
│   │   ├── client.ts             # Stripe SDK instance
│   │   ├── checkout.ts           # Checkout session helpers
│   │   ├── subscriptions.ts      # Tuition plan helpers
│   │   └── webhooks.ts           # Webhook handler
│   │
│   ├── email/
│   │   ├── resend.ts             # Resend client + send helpers
│   │   ├── klaviyo.ts            # Klaviyo API helpers
│   │   └── templates/            # Email template components
│   │
│   ├── video/
│   │   ├── cloudflare-stream.ts  # Upload, transcode, playback helpers
│   │   └── live.ts               # Live streaming helpers
│   │
│   ├── ai/
│   │   ├── client.ts             # Claude API client
│   │   ├── placement.ts          # Class placement AI
│   │   └── prompts.ts            # System prompts
│   │
│   ├── utils/
│   │   ├── formatting.ts         # Date, currency, phone formatting
│   │   ├── validation.ts         # Shared Zod schemas
│   │   └── constants.ts          # App-wide constants
│   │
│   └── hooks/
│       ├── use-auth.ts
│       ├── use-supabase.ts
│       ├── use-debounce.ts
│       └── use-media-query.ts
│
├── types/
│   ├── database.ts               # Generated from Drizzle schema
│   ├── api.ts                    # API request/response types
│   └── index.ts                  # Shared type exports
│
├── public/
│   ├── fonts/
│   ├── images/
│   └── icons/
│
├── docs/
│   ├── claude/                   # Claude context files
│   │   ├── BRAND.md
│   │   ├── DATA_MODEL.md
│   │   ├── MODULES.md
│   │   ├── STACK.md
│   │   ├── UX_PATTERNS.md
│   │   └── SECURITY.md
│   ├── strategy/
│   ├── marketing/
│   ├── operations/
│   ├── expansion/
│   └── brand/
│
├── supabase/
│   ├── config.toml               # Supabase local config
│   ├── migrations/               # SQL migrations
│   └── seed.sql                  # Dev seed data
│
├── CLAUDE.md                     # Root AI context
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── drizzle.config.ts
├── .env.local                    # Local env vars (git-ignored)
├── .env.example                  # Template for env vars
└── .gitignore
```

---

## 3. Environment Variables

### `.env.example`

```bash
# ============================================================
# BAM Platform Environment Variables
# Copy to .env.local and fill in values
# ============================================================

# --- App ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="Ballet Academy and Movement"

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# --- Stripe ---
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# --- Resend (Transactional Email) ---
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=dance@bamsocal.com
RESEND_FROM_NAME="Ballet Academy and Movement"

# --- Klaviyo (Marketing Email) ---
KLAVIYO_API_KEY=pk_...
KLAVIYO_PRIVATE_KEY=...

# --- Cloudflare Stream ---
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_STREAM_API_TOKEN=...
CLOUDFLARE_STREAM_SIGNING_KEY=...

# --- Claude AI ---
ANTHROPIC_API_KEY=sk-ant-...

# --- Twilio (SMS) ---
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# --- Google (Optional — Photos API for M13) ---
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

### Environment Variable Rules

- **Never commit `.env.local`** — it's in `.gitignore`
- **`NEXT_PUBLIC_` prefix** = available in browser (public, non-secret)
- **All other vars** = server-only (API routes, server components, server actions)
- **Stripe keys:** Use `pk_test_` / `sk_test_` in development, `pk_live_` / `sk_live_` in production
- **Supabase anon key** is safe to expose (RLS enforces access control)
- **Service role key** is admin-level — server-only, never in client code

---

## 4. TypeScript Configuration

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    },
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### TypeScript Rules

- **`strict: true`** — non-negotiable
- **No `any` types** — use `unknown` and narrow, or define proper types
- **Derive types from Drizzle schema** — `typeof table.$inferSelect` and `$inferInsert`
- **Zod for runtime validation** — every API route input validated with Zod
- **Type exports:** shared types live in `types/`, component-specific types co-locate with the component

---

## 5. Coding Conventions

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Components | kebab-case | `casting-board.tsx` |
| Pages | `page.tsx` in directory | `app/(admin)/admin/classes/page.tsx` |
| Layouts | `layout.tsx` in directory | `app/(portal)/layout.tsx` |
| API routes | `route.ts` in directory | `app/api/students/route.ts` |
| Utilities | kebab-case | `lib/utils/formatting.ts` |
| Types | kebab-case | `types/database.ts` |
| Hooks | camelCase with `use-` prefix | `lib/hooks/use-auth.ts` |
| Constants | SCREAMING_SNAKE_CASE values | `MAX_CLASS_SIZE = 10` |

### Component Conventions

```tsx
// One component per file
// Named export for non-page components
// Default export for page components

// Named export example (components/studio/class-card.tsx)
export function ClassCard({ class: classData }: ClassCardProps) {
  return (...)
}

// Default export example (app/(admin)/admin/classes/page.tsx)
export default async function ClassesPage() {
  return (...)
}
```

### Server vs. Client Components

- **Default to Server Components** — fetch data, render HTML, zero JS shipped
- **Use `'use client'`** only when needed:
  - Event handlers (onClick, onChange, onSubmit)
  - Browser APIs (localStorage, geolocation)
  - React hooks (useState, useEffect, useRef)
  - Interactive UI (modals, dropdowns, drag-and-drop)
- **Pattern:** Server component fetches data → passes to client component for interactivity

```tsx
// app/(admin)/admin/classes/page.tsx (Server Component)
export default async function ClassesPage() {
  const classes = await getClasses()
  return <ClassList initialData={classes} />
}

// components/studio/class-list.tsx (Client Component)
'use client'
export function ClassList({ initialData }: { initialData: Class[] }) {
  const [search, setSearch] = useState('')
  // ... interactive filtering
}
```

### API Route Conventions

```tsx
// app/api/students/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const createStudentSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().date(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'pre_professional']),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate input
  const body = await request.json()
  const parsed = createStudentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // ... create student
  return NextResponse.json({ data: student }, { status: 201 })
}
```

### Data Fetching Conventions

- **Server Components:** Direct Supabase queries or Drizzle ORM
- **Client Components:** React Query (`@tanstack/react-query`) for server state
- **Mutations:** Server Actions preferred for forms, API routes for complex operations
- **Never fetch unbounded datasets** — always paginate with limit/offset or cursor
- **Default page size:** 25 items

### Error Handling

- API routes: return structured error responses `{ error: string, details?: unknown }`
- Client components: error boundaries at route segment level
- Forms: inline validation errors with Zod, toast for server errors
- Never show raw error messages to users — map to friendly copy
- Log server errors with context (user ID, route, input)

### Import Order

```tsx
// 1. React/Next
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 2. External packages
import { z } from 'zod'
import { format } from 'date-fns'

// 3. Internal: lib
import { createServerClient } from '@/lib/supabase/server'

// 4. Internal: components
import { Button } from '@/components/ui/button'
import { ClassCard } from '@/components/studio/class-card'

// 5. Internal: types
import type { Class } from '@/types/database'

// 6. Relative imports (same module)
import { formatClassName } from './utils'
```

---

## 6. Package Dependencies

### Core

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "drizzle-orm": "^0.x",
    "stripe": "^17.x",
    "@stripe/stripe-js": "^4.x",
    "resend": "^4.x",
    "zod": "^3.x",
    "@tanstack/react-query": "^5.x",
    "zustand": "^5.x",
    "date-fns": "^4.x",
    "lucide-react": "latest",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/react": "^19.x",
    "@types/node": "^22.x",
    "tailwindcss": "^4.x",
    "@tailwindcss/postcss": "latest",
    "postcss": "^8.x",
    "eslint": "^9.x",
    "eslint-config-next": "^15.x",
    "drizzle-kit": "^0.x",
    "prettier": "^3.x",
    "prettier-plugin-tailwindcss": "^0.x"
  }
}
```

---

## 7. Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start Supabase local (requires Docker)
npx supabase start

# Run migrations
npx drizzle-kit push

# Seed development data
npx supabase db seed

# Start dev server
npm run dev
```

### Database Migrations

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migration
npx drizzle-kit push

# View current schema
npx drizzle-kit studio
```

### Deployment

- **Production:** Push to `main` → Vercel auto-deploys
- **Preview:** Push to feature branch → Vercel preview deployment
- **Database migrations:** Run against Supabase production via CLI before deploying
- **Environment variables:** Set in Vercel dashboard (never in code)

### Git Conventions

- **Branch naming:** `feature/module-name`, `fix/bug-description`, `docs/topic`
- **Commit messages:** Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- **PRs:** Required for production; squash merge to main

---

*Last updated: March 2026*
