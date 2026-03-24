# Performance Media & Monetization — Spec

**Status:** Pre-spec — product vision captured  
**Phase:** 4 — Monetization & Media  
**Related Modules:** TICKETING.md, PERFORMANCE_COMPETITION_COSTS.md, ADVERTISING.md, SAAS.md

---

## 1. Multi-Camera Live Streaming

### Concept
Studio performances streamed live with multiple simultaneous camera angles. Parents and family members can watch from anywhere and switch between views — modeled on the Masters Golf App and Ring Camera multi-feed UX.

### Camera Views
| View | Description |
|---|---|
| Main Stage | Primary wide shot of full stage |
| Front Row | Low angle, close to stage |
| Backstage | Green room / backstage preparation |
| Back of Venue | Full audience + stage perspective |
| Side Left | Stage left wing view |
| Side Right | Stage right wing view |
| Custom | Studio can add additional camera positions |

### Viewer Experience
- Parent opens BAM app → taps "Watch Live"
- Sees primary feed with thumbnail switcher for all active cameras
- Tap any thumbnail to switch to that view full screen
- Picture-in-picture: watch two angles simultaneously
- Chat/reaction rail alongside stream (emoji reactions only — no text chat)
- Stream quality auto-adjusts to connection speed

### Technical Architecture
- Cloudflare Stream as primary video infrastructure (already in stack)
- Multi-camera ingest via RTMP from each camera position
- Cloudflare Stream supports multiple simultaneous streams per event
- Admin creates a "Stream Event" — assigns camera slots, generates RTMP keys per camera
- Stream goes live when admin hits "Go Live" button
- Latency target: under 10 seconds

### Access Control
- Live stream access tied to ticket purchase OR family enrollment
- Tenant configurable: enrolled families only / ticket purchasers / pay-per-view
- Geographic restriction option (studio can limit to US only)

---

## 2. AI-Powered Video Editing

### Student Tagging
- AI automatically tags students to specific scenes/time codes during or after the event
- Tags suggested based on face/costume recognition — teacher or admin verifies before release
- System tracks which camera angle best captures each student at each moment
- Tags stored as: { student_id, camera_id, time_start, time_end, confidence, manually_verified }
- Manual tagging available to override or supplement AI suggestions

### Custom Highlight Reels (Per Student)
- After event: system auto-generates a highlight reel per tagged student
- Pulls best clips of that student across all camera angles
- Prioritizes close-up angles, well-lit shots, and clean solo moments
- Even students in the back row get highlighted via close-up cuts
- Output: 2–5 minute highlight video per student
- Available for both recital and competition events

### Full Show Edit
- AI assembles a director's cut of the full show
- Switches between camera angles for best coverage
- Syncs to soundboard audio feed (requires audio integration)

### Soundboard Audio Integration
- Studio connects audio board output to stream ingest
- AI syncs video edits to audio peaks, music cues, and applause moments
- Licensed music rights handled separately (see Section 4)

### Edit Output Formats
| Product | Description |
|---|---|
| Highlight Reel | 2–5 min student-specific edit |
| Full Show (Director's Cut) | Complete show, best angles |
| Class Group Video | All students in a specific class/routine |
| Backstage Reel | Behind-the-scenes compilation |
| Social Clip | 30–60 sec vertical format for Instagram/TikTok — auto-muted on download with option to add licensed music |

### Quality Gate (Processing Time)
- Recommended minimum processing time before admin can release: **2 hours**
- Rationale: allows AI to complete tagging, generate all highlight reels, and run basic quality checks
- Admin can override the gate if needed (with confirmation warning)
- BAM Platform Admin can configure the default quality gate duration globally
- Tenant admins cannot reduce below the platform minimum

---

## 3. Monetization Model

### Watermarked Preview
- All video products shown to parents as heavily watermarked previews immediately after the event
- Watermark: studio logo + "Preview Only" overlay at 40% opacity
- Studio Admin releases previews — parents cannot see until admin hits "Release"
- Admin can pause AI processing before release to review content

### Purchase Flow
- Parent sees preview in app → "Purchase" button
- Individual products or bundles
- Stripe charge to existing family account
- Download available immediately after purchase
- Studio Admin receives revenue minus platform fee

### Discount Codes
- Admin generates discount codes per event or globally
- Admin determines: single-use or multi-use
- Multi-use codes: admin sets usage limit (e.g. max 50 redemptions)
- Codes apply to individual products or entire bundles
- Expiry date optional
- Codes tracked in admin dashboard with redemption count

### Bundles
- Two types: pre-built (created before the show) and dynamic (created after)
- Admin creates custom bundles combining video, photo, and merch products
- Bundle pricing set by admin (can be less than sum of parts)
- Both types supported simultaneously

### Pricing Model (Tenant-Configurable)
| Product | Suggested Price |
|---|---|
| Student Highlight Reel | $19.99–$39.99 |
| Full Show Download | $29.99–$49.99 |
| Social Clip Pack (3 clips) | $9.99–$14.99 |
| Photo Package (from shoot) | $29.99–$99.99 |
| Bundle (highlight + photos) | $49.99–$79.99 |

### Platform Revenue Share
- BAM Platform takes configurable % per sale (default: 15%)
- Studio keeps remainder
- Monthly payout to studio via Stripe Connect
- Sales dashboard in admin: units sold, revenue, payout status

### No Subscriptions
- No subscription model for media products — per-event purchase only

---

## 4. Licensed Music Rights

### BAM Relationships
- BAM has existing relationships with ASCAP and BMI
- These relationships should be leveraged for platform-wide blanket licensing negotiations

### Approach
| Scenario | Solution |
|---|---|
| Student performances to licensed music | Sync license required per song per use |
| Social clips (30–60 sec) | Auto-muted on download; parent can optionally add licensed music |
| Platform-wide blanket license | Negotiate with ASCAP/BMI using existing BAM relationship |
| AI-generated background music | Use royalty-free AI music (Suno, Udio, or similar) for non-performance segments |

### Social Clip Music Flow
- Social clips downloaded without music by default (auto-muted)
- In-app option: "Add licensed music" — presents curated licensed track options
- Licensed tracks available via in-app purchase or included in premium bundles
- Parent selects track → platform handles sync license → clip delivered with music

### Implementation Path
- Phase 1: Auto-mute social clips, flag all videos as "may contain copyrighted music"
- Phase 2: Integrate with music licensing API (Songfile, Harry Fox) for per-song sync licenses
- Phase 3: Negotiate platform-wide blanket license with ASCAP/BMI using existing relationships

---

## 5. Photo Packages

### Integration with Video Products
- Photo shoots sold alongside video products
- Bundled packages available at checkout
- Photos uploaded by studio photographer or imported from third-party shoot service
- Student tagging applies to photos — parents see only their child's photos

### Print-on-Demand Merch
- Primary vendor: Printful (first integration)
- Future vendors: Gelato, Printify — tenant selects preferred vendor in settings
- Products: photo books, canvas prints, ornaments, mugs, tote bags, custom apparel
- Giftable packaging: gift wrap option, gift message, direct ship to recipient address
- Available immediately after show when admin releases

### Merch Packages (Suggested)
| Package | Contents |
|---|---|
| Digital Only | Highlight reel + photo gallery download |
| Keepsake | Digital + 5x7 print + ornament |
| Grandparent Gift | Digital + photo book + mug |
| Full Collection | All digital + photo book + canvas + ornament + apparel |

### Revenue Model
- Merch sold at markup over print cost
- Platform takes % of merch sales (same revenue share as video)
- Studio can set custom pricing per product
- Printful handles fulfillment — no studio inventory required

---

## 6. White-Label Video Player

- Available at premium SaaS licensing tier: $750/mo and above
- Pricing tiers set by BAM Platform Admin (not tenant admins)
- Includes: studio branding on video player UI, download files, merch packaging, email notifications
- Custom domain for video delivery (e.g. video.studiodomain.com)
- White-label tier unlocks as part of overall platform licensing — not sold as a standalone add-on

---

## 7. Competition Streaming

- Same multi-camera and highlight reel features available for competition events
- Sold as the same SKU as recital streaming — but may be sold exclusively to competition producers as a module
- Competition producers can purchase this module to offer to their participating studios
- Competition highlight reels follow same flow as recital highlight reels
- Access control: competition families only, or broader access if sold to competition producer

---

## 8. Release Workflow (Admin)

### Post-Show Release Flow
```
[Show ends]
     ↓
[AI begins processing automatically — highlight reels, director's cut, clips]
     ↓
[Admin can pause processing at any time for review]
     ↓
[Quality gate: minimum 2-hour processing window before release is enabled]
[BAM Platform Admin configures this minimum globally]
     ↓
[Admin receives notification: "Processing complete — X products ready for review"]
     ↓
[Admin previews each product, verifies AI tags, approves content]
     ↓
[Admin hits "Release to Families" — or schedules release for specific date/time]
     ↓
[Parents receive push notification: "Your [Student Name] highlight reel is ready!"]
     ↓
[Purchase window opens — admin sets duration or scheduled close date]
     ↓
[Parents purchase — download available immediately]
     ↓
[Purchase window closes — products archived]
```

### Admin Controls
- Release individual products or all at once
- Schedule release date/time in advance
- Schedule purchase window close date/time OR close manually
- Set pricing per product or use defaults
- Create and apply discount codes (single-use or multi-use with limits)
- Create pre-built and dynamic bundles
- View real-time sales dashboard
- Trigger re-processing if edits need corrections
- Block specific clips

---

## 9. App Integration

### Parent App Experience
- Push notification when preview is released
- Full-screen video player with watermark
- One-tap purchase with saved payment method
- Download manager — tracks all purchased content
- Social clips: auto-muted on download, option to add licensed music in-app
- Share to social: watermark removed after purchase, BAM branding frame added

### Relative/Gift Purchase
- Parent can purchase a product as a gift for a grandparent or relative
- Recipient receives email with download link (no app required)
- Gift packaging option at checkout
- Giftable merch ships directly to recipient

---

## 10. Decisions Log

| # | Decision |
|---|----------|
| 1 | Print-on-demand: Printful first; Gelato and Printify as future options |
| 2 | AI tagging: automatic with teacher/admin verification step before release |
| 3 | Minimum camera setup: 1 camera (single main stage view) — additional views are additive |
| 4 | Competition streaming: same SKU as recital — optionally sold as standalone module to competition producers |
| 5 | Competition highlight reels: yes — same flow as recital highlight reels |
| 6 | Processing time: ASAP after show — admin can pause; recommended quality gate = 2 hours minimum |
| 7 | White-label video player: yes — available at $750/mo+ licensing tier, set by BAM Platform Admin |
| 8 | Purchase window: admin schedules close date/time or closes manually |
| 9 | Discount codes: admin determines single-use or multi-use; multi-use has admin-set usage limit |
| 10 | Bundles: both pre-built (before show) and dynamic (after show) supported |
| 11 | Subscriptions: no |
| 12 | Social clips: auto-muted on download; in-app option to add licensed music |
| 13 | Music licensing: BAM has existing ASCAP and BMI relationships — leverage for blanket license |
| 14 | Quality gate duration: set by BAM Platform Admin globally; tenant admins cannot go below platform minimum |

---

## 11. Open Questions

- [ ] What is the budget for blanket music licensing in Year 1?
- [ ] Should the quality gate minimum be 2 hours — or does BAM want to validate this with production experience first?
- [ ] Should competition streaming be gated behind a separate contract with competition producers, or self-serve signup?
- [ ] What is the full pricing tier structure above $750/mo? (e.g. $750 / $1,200 / $2,000)
- [ ] Should discount codes be scoped to a specific event, or usable across all events for a studio?
- [ ] Should there be a minimum purchase window (e.g. admin cannot close sales in under 24 hours)?
- [ ] Should Printful integration require studios to create their own Printful account, or does BAM manage a master account?
