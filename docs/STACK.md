# BAM Platform — Technical Stack

## Repository
- **Repo:** github.com/greenlyzard/bam-platform
- **Branch strategy:** `main` (production) | `staging` (staging) | `dev/*` (feature branches)
- **Deploy target:** Vercel Pro

## URLs
| Environment | URL |
|-------------|-----|
| Production | portal.balletacademyandmovement.com |
| Staging | staging.balletacademyandmovement.com |
| Vercel default | bam-platform.vercel.app |

---

## Frontend

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 15 (App Router) | Use Server Components by default |
| Language | TypeScript (strict mode) | No `any` types — ever |
| Styling | Tailwind CSS | Custom BAM design tokens in tailwind.config |
| Components | shadcn/ui + custom | shadcn for base, custom for BAM-branded |
| Icons | Lucide React | Stroke 1.5px, thin outline only |
| Fonts | Cormorant Garamond + Montserrat | Load via next/font/google (300, 400, 500, 600) |
| Animations | Framer Motion | Subtle, 200–300ms, ease-in-out |
| Forms | React Hook Form + Zod | Validation on client + server |
| State | Zustand (global) + React Query (server) | |
| Mobile video | Custom swipe component | TikTok-style for student LMS feed |

---

## Backend

| Layer | Choice | Notes |
|-------|--------|-------|
| Database | Supabase (PostgreSQL) | RLS on every table |
| Auth | Supabase Auth | Magic link + Google OAuth |
| Storage | Supabase Storage | Images, documents, PDFs |
| Video | Cloudflare Stream | All video content + live streaming |
| Realtime | Supabase Realtime | Attendance, live status, notifications |
| Email (transactional) | Resend | Receipts, confirmations, magic links |
| Email (marketing) | Klaviyo | Nurture sequences, newsletters |
| Payments | Stripe | Ticket sales, shop checkout |
| SMS | Twilio (future) | Class reminders, alerts |

---

## Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| GoStudioPro (Dance Studio Pro) | Studio management, class scheduling | Existing — API sync |
| Klaviyo | Email marketing, lead nurture | Connected |
| Zapier | Workflow automation between services | Existing |
| Google Analytics 4 | Traffic, conversion tracking | To implement |
| Google Search Console | SEO monitoring | To implement |
| Cloudflare Stream | Video hosting + live streaming | To implement |
| Stripe | Payment processing | To implement |

---

## Project Structure

```
bam-platform/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth routes (login, signup)
│   ├── (portal)/                 # Parent portal
│   │   └── portal/
│   ├── (teach)/                  # Teacher portal
│   │   └── teach/
│   ├── (admin)/                  # Admin dashboard
│   │   └── admin/
│   ├── (learn)/                  # LMS
│   │   └── learn/
│   ├── (shop)/                   # Studio shop
│   │   └── shop/
│   ├── api/                      # API routes (server-side only)
│   │   ├── auth/
│   │   ├── enrollments/
│   │   ├── lms/
│   │   ├── stream/
│   │   └── webhooks/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                       # shadcn/ui base components
│   ├── bam/                      # BAM-branded components
│   │   ├── DancerCard.tsx
│   │   ├── ClassCard.tsx
│   │   ├── BadgeDisplay.tsx
│   │   ├── LiveStreamPlayer.tsx
│   │   ├── SwipeFeed.tsx         # TikTok-style student feed
│   │   └── ProgressConstellation.tsx
│   └── layouts/
│       ├── ParentLayout.tsx
│       ├── TeacherLayout.tsx
│       ├── AdminLayout.tsx
│       └── StudentLayout.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server component client
│   │   └── middleware.ts         # Auth middleware
│   ├── cloudflare/
│   │   └── stream.ts
│   ├── resend/
│   │   └── emails.ts
│   ├── klaviyo/
│   │   └── api.ts
│   └── utils.ts
├── types/
│   └── database.ts               # Generated from Supabase schema
├── docs/
│   └── claude/                   # Claude Code skill files (this folder)
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── public/
│   └── brand/                    # Logos, brand assets
├── .env.local                    # Never commit
├── .env.example                  # Commit with placeholder values
└── tailwind.config.ts
```

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Server-side only — never expose to client

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@balletacademyandmovement.com

# Klaviyo
KLAVIYO_API_KEY=
KLAVIYO_LIST_ID_LEADS=
KLAVIYO_LIST_ID_ENROLLED=

# Stripe
STRIPE_SECRET_KEY=                  # Server-side only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Cloudflare Stream
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_STREAM_API_TOKEN=        # Server-side only

# App
NEXT_PUBLIC_APP_URL=https://portal.balletacademyandmovement.com
```

---

## Coding Conventions

### TypeScript
```typescript
// Always type Supabase responses
const { data, error } = await supabase
  .from('students')
  .select('*')
  .returns<Student[]>()

// Use zod for all external input validation
const EnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
})
```

### Server vs Client Components
```typescript
// Default: Server Component (no 'use client')
// Client only when needed: interactivity, hooks, browser APIs
'use client' // only add this when required
```

### API Routes
```typescript
// Always validate auth in API routes
const supabase = createServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Error Handling
```typescript
// Always handle Supabase errors explicitly
if (error) {
  console.error('[module:action]', error)
  return { error: error.message }
}
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| TTI | < 3.5s |
| Lighthouse Score | ≥ 90 (all categories) |

---

## Security Rules

1. **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the client
2. **Always** use RLS — no table should ever have RLS disabled in production
3. **Always** validate auth in API routes — never trust client claims
4. **Never** store sensitive data (medical notes) in localStorage
5. **Always** sanitize user input before storing
6. **Never** log PII (emails, names, medical info) to console in production
7. Mandated reporter incidents must be flagged for admin review immediately
