# Media Hub — Spec

**Status:** Ready for implementation  
**Phase:** 3 — Revenue & Parent Experience  
**Decision Log Date:** April 9, 2026  
**Related Modules:** STUDENT_PROFILE.md, PERFORMANCE_MEDIA_AND_MONETIZATION.md, BILLING_AND_CREDITS.md

---

## 1. Overview

The Media Hub is a revenue center built into the platform. Every performance, 
recital, and competition becomes a storefront where parents can purchase photos, 
videos, and personalized content featuring their child.

**Three revenue streams:**
1. **Photo sales** — individual downloads, prints, photo books
2. **Video sales** — full performance recordings, personalized student edits
3. **AI-personalized content** — auto-zoomed highlight reels, social-ready clips

This is a significant differentiator. No current dance studio software 
(Dance Studio Pro, Jackrabbit, Pike13) does this. It positions BAM as 
premium and creates ongoing revenue beyond tuition.

---

## 2. Photo Hub

### 2.1 Photo Sources

| Source | How It Gets In | Storage |
|---|---|---|
| Photographer delivery | Admin links Google Photos shared album | Google Photos (linked) |
| AI face-tagged import | Google Photos API pulls student-specific photos | Supabase Storage (curated) |
| Direct admin upload | Admin uploads via platform | Supabase Storage |
| Student headshots | Admin uploads headshot per student | Supabase Storage |

### 2.2 Photo Approval Workflow

```
Photographer delivers → Google Photos album created
         ↓
Admin links album to production in platform
         ↓
Platform imports photo metadata via Google Photos API
         ↓
AI face recognition identifies students in each photo
         ↓
Admin reviews tagged photos (approve / reject / re-tag)
         ↓
Admin sets pricing per photo (free OR paid)
         ↓
If paid: watermark applied automatically
         ↓
Parents see photos on student profile + production gallery
         ↓
Purchase → watermark removed → download available
```

### 2.3 Photo Pricing Model

Per photo (admin-configurable per production):

| Option | Setting | Result |
|---|---|---|
| Free | is_paid = false | Parent downloads full-res, no watermark |
| Paid | is_paid = true, price_cents set | Watermarked preview, purchase to unlock |
| Free for enrolled families | is_paid = false for members | Non-members pay |

### 2.4 Watermarking

When a photo is set to paid:
- Platform applies a semi-transparent watermark overlay (BAM logo + "balletacademyandmovement.com")
- Watermark generated server-side on the fly — original never exposed
- After purchase: watermark-free version delivered immediately
- Watermark position: diagonal across center (not corner — harder to crop)

### 2.5 Photo Products

| Product | Description | Pricing |
|---|---|---|
| Digital download | Full-resolution JPEG | $5–15 per photo |
| Print (4x6, 5x7, 8x10) | Ordered via print partner (e.g. Printful) | $8–25 |
| Photo book | Curated album of season photos | $35–65 |
| Social pack | 3–5 photos cropped for Instagram/Stories | $12 |

Admin configures which products are available per production.

### 2.6 Curated Student Photos

Each student profile has a "Featured Photos" section — admin-curated 
photos that represent this student's best moments. These appear:
- On the student profile Photos tab
- On the shareable public profile (if enabled)
- As defaults for photo book covers

---

## 3. Video Hub

### 3.1 Video Sources

**Multi-camera performance recording:**
- Studio sets up 2–3 camera positions for each performance
- Cameras record simultaneously
- Raw footage delivered to admin (via upload or cloud transfer)

**AI editing pipeline (Phase 2):**
- Upload multi-camera footage
- Specify each student's position on stage (or use AI pose detection)
- AI generates:
  - Full performance edit (all students)
  - Per-student personalized edit (auto-zoom follows the student)
  - Highlight reel (best 60–90 seconds per student)
  - Social clips (15s and 30s vertical format for Instagram/TikTok)

### 3.2 Video Products

| Product | Description | Pricing |
|---|---|---|
| Full performance | Complete show, all students | $25–35 |
| Personalized edit | 45–90 min edit focused on one student | $35–50 |
| Highlight reel | 60–90 second best moments | $15–25 |
| Social pack | 15s + 30s vertical clips, watermark-free | $10–15 |
| Season bundle | All products for one student for the season | $75–99 |

### 3.3 Video Storage

Videos stored on **Cloudflare Stream** (already planned in the roadmap):
- Adaptive bitrate streaming
- Per-video access tokens (purchase required)
- Watermarked preview (low quality, BAM logo overlay)
- Full quality stream unlocked after purchase

### 3.4 AI Personalization Pipeline

**Phase 1 (manual):**
- Admin uploads the finished per-student edit manually
- No AI — videographer does the editing

**Phase 2 (AI-assisted):**
- Admin uploads raw multi-camera footage
- Platform sends to AI editing service (e.g. Descript, custom pipeline)
- AI generates per-student edit based on face recognition + stage position
- Admin reviews and approves before publishing

**Phase 3 (fully automated):**
- Cameras connected to platform
- AI generates all products automatically within hours of a performance
- Parents receive push notification: "Sofia's Nutcracker highlight reel is ready!"

### 3.5 Social-Ready Clips

The most viral feature. After a performance:
- Parent receives a 15-second vertical clip of their child's best moment
- Pre-formatted for Instagram Reels, TikTok, Facebook Stories
- Includes BAM branding overlay (subtle — bottom corner)
- Parent can share directly from the platform or download
- Free version: includes BAM watermark (free marketing)
- Premium version: clean, no watermark — $5

---

## 4. Google Photos Integration

### 4.1 OAuth Setup (one-time)

Amanda connects the studio's Google Photos account to the platform:
1. Admin → Settings → Integrations → Google Photos
2. Click "Connect Google Photos"
3. OAuth flow — Amanda grants access to her Google Photos account
4. Platform stores refresh token securely

### 4.2 Album Management

Admin links Google Photos albums to productions:
- Create a Production in the platform
- Link one or more Google Photos albums to that production
- Platform pulls all photos from linked albums via API
- Photos displayed in production gallery + tagged to students

### 4.3 Face Recognition → Student Tagging

1. Platform submits each student's headshot to Google Photos API
2. Google identifies matching faces across linked albums
3. Platform shows admin: "These photos appear to include Sofia (87% confidence)"
4. Admin confirms or corrects tagging
5. Confirmed photos appear on student profile

### 4.4 What Google Photos API Provides

- List albums and photos
- Get individual photo URLs (temporary signed URLs)
- Face groupings (Google's internal face ID, not names)

**What it does NOT provide:**
- Direct facial recognition against an external photo (headshot)
- Named person identification across accounts

**Workaround:** Use platform-side face matching. Upload student headshots 
to a face recognition service (AWS Rekognition or Google Vision API) to 
match faces in performance photos to student headshots. This is separate 
from Google Photos.

---

## 5. Database Schema

```sql
-- Production media albums
CREATE TABLE IF NOT EXISTS media_albums (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  production_id   uuid REFERENCES productions(id),
  name            text NOT NULL,
  album_type      text NOT NULL
    CHECK (album_type IN ('photos','video','mixed')),
  google_photos_album_id text,
  google_photos_album_url text,
  status          text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','processing','published','archived')),
  is_public       boolean DEFAULT false,
  created_by      uuid REFERENCES profiles(id),
  published_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Individual media items (photos and videos)
CREATE TABLE IF NOT EXISTS media_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  album_id        uuid REFERENCES media_albums(id),
  media_type      text NOT NULL CHECK (media_type IN ('photo','video')),
  
  -- Storage
  storage_path    text,           -- Supabase Storage path (for hosted media)
  google_photos_id text,          -- Google Photos media item ID
  cloudflare_stream_id text,      -- Cloudflare Stream video ID
  
  -- Display
  title           text,
  description     text,
  thumbnail_url   text,
  duration_seconds integer,       -- for videos
  width           integer,
  height          integer,
  
  -- Approval
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  approved_by     uuid REFERENCES profiles(id),
  approved_at     timestamptz,
  
  -- Pricing
  is_paid         boolean DEFAULT false,
  price_cents     integer DEFAULT 0,
  is_watermarked  boolean DEFAULT false,
  
  -- Student tagging
  tagged_student_ids uuid[] DEFAULT '{}',
  face_detection_confidence numeric,
  
  -- Products available
  products_available text[] DEFAULT '{}',
    -- ['digital_download','print_4x6','print_5x7','print_8x10','social_pack']
  
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Student-specific video products
CREATE TABLE IF NOT EXISTS student_video_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  media_album_id  uuid NOT NULL REFERENCES media_albums(id),
  product_type    text NOT NULL
    CHECK (product_type IN (
      'full_performance','personalized_edit','highlight_reel',
      'social_clip_15','social_clip_30','season_bundle'
    )),
  cloudflare_stream_id text,
  price_cents     integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','ready','published')),
  is_watermarked  boolean DEFAULT true,
  duration_seconds integer,
  created_at      timestamptz DEFAULT now()
);

-- Purchases
CREATE TABLE IF NOT EXISTS media_purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  family_id       uuid NOT NULL REFERENCES families(id),
  purchased_by    uuid NOT NULL REFERENCES profiles(id),
  
  -- What was purchased
  media_item_id   uuid REFERENCES media_items(id),
  student_video_product_id uuid REFERENCES student_video_products(id),
  product_type    text NOT NULL,
    -- 'photo_download','photo_print','video_stream','social_pack','photo_book','season_bundle'
  
  -- Payment
  amount_cents    integer NOT NULL,
  stripe_payment_intent_id text,
  
  -- Delivery
  download_url    text,           -- signed URL, expires after 48 hours
  download_expires_at timestamptz,
  print_order_id  text,           -- external print fulfillment ID
  
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','refunded','failed')),
  
  purchased_at    timestamptz DEFAULT now()
);

-- Google Photos OAuth tokens (per tenant)
CREATE TABLE IF NOT EXISTS google_photos_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) UNIQUE,
  google_account_email text NOT NULL,
  access_token    text,           -- encrypted
  refresh_token   text NOT NULL,  -- encrypted
  token_expires_at timestamptz,
  connected_by    uuid REFERENCES profiles(id),
  connected_at    timestamptz DEFAULT now(),
  last_synced_at  timestamptz
);
```

---

## 6. Admin Media Hub UI

### `/admin/media`

**Overview:**
- Revenue dashboard: total media revenue, purchases this month, top-selling productions
- Quick actions: Upload new album, Link Google Photos, Create video product

**Productions tab:**
- List of productions with photo/video counts, revenue generated
- Click → production media detail

**Production Media Detail:**
- Photos grid with approval status (pending/approved/rejected)
- Bulk approve/reject
- Set pricing (free vs paid, price per photo)
- Tag students (AI suggestions + manual confirmation)
- Publish album (makes visible to parents)

**Student Videos tab:**
- Per-student video products with processing status
- Upload personalized edit for a student
- Set pricing and publish

### `/admin/students/[id]/profile` — Photos tab

- Featured photos (curated from approved media)
- Google Photos albums linked to this student
- All tagged photos across all productions
- Upload headshot

---

## 7. Parent Media Experience

### `/portal/media`

**My Child's Photos:**
- All approved, tagged photos of their student(s)
- Free photos: download immediately
- Paid photos: watermarked preview + purchase button

**My Child's Videos:**
- Performance videos available for purchase
- Preview: 10-second watermarked clip
- Purchase → stream full quality immediately

**My Purchases:**
- Download history
- Re-download purchased items (30-day window)
- Print order status

### Notification Flow

When new media is published:
- Push notification: "Sofia's Nutcracker photos are ready! 47 photos available."
- Email: preview of 3 best photos, link to view all
- If personalized video ready: "Sofia's highlight reel is ready to watch!"

---

## 8. Build Phases

### Phase 1 — Photos (build now)
- Media albums + media items tables
- Admin photo upload + approval workflow
- Student tagging (manual)
- Pricing + watermarking
- Parent photo gallery
- Basic purchase flow (Stripe)

### Phase 2 — Google Photos + AI Tagging
- Google Photos OAuth connection
- Album sync via API
- Face recognition via AWS Rekognition or Google Vision
- Auto-tagging with admin confirmation

### Phase 3 — Video Products
- Cloudflare Stream integration
- Manual video upload per student
- Purchase + streaming flow
- Social clip download

### Phase 4 — AI Video Editing
- Multi-camera upload pipeline
- AI editing service integration
- Automated per-student product generation
- Fully automated post-performance workflow

---

## 9. Decisions Log

| # | Decision |
|---|---|
| 1 | Admin AND Amanda can approve photos |
| 2 | Admin sets each photo/album as free or paid — not a platform default |
| 3 | Paid photos require watermarking — diagonal overlay, not corner |
| 4 | Watermark applied server-side — original never exposed to client |
| 5 | Video storage: Cloudflare Stream (already in roadmap) |
| 6 | Google Photos = source/delivery; Supabase Storage = curated/featured |
| 7 | Face recognition via AWS Rekognition or Google Vision (not Google Photos API directly) |
| 8 | Social clips: free with BAM watermark OR $5 watermark-free |
| 9 | Photo products: digital download, prints (via Printful), photo book, social pack |
| 10 | Video products: full performance, personalized edit, highlight reel, social clips, season bundle |
| 11 | Build phases: Photos first → Google Photos API → Videos → AI editing |
| 12 | Parent gets push + email notification when new media is published |
| 13 | Download links are signed URLs expiring after 48 hours |
| 14 | Re-download available within 30-day window after purchase |
