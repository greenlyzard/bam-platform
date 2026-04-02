# Enrollment Widget — BAM Platform Spec

## Overview
A drop-in JavaScript widget that embeds the BAM enrollment
wizard on any third-party website (WordPress, Squarespace,
Wix, custom HTML). Powers the white-label SaaS offering —
each tenant gets their own branded enrollment experience
without rebuilding their website.

## Embed Code (what studio owners paste into their site)

### Full wizard embed
```html
<div id="bam-enrollment"></div>
<script
  src="https://portal.balletacademyandmovement.com/widget.js"
  data-tenant="TENANT_ID"
  data-mode="wizard"
  data-primary-color="#9C8BBF"
  data-font="Cormorant Garamond"
></script>
```

### Class catalog only
```html
<div id="bam-enrollment"></div>
<script
  src="https://portal.balletacademyandmovement.com/widget.js"
  data-tenant="TENANT_ID"
  data-mode="catalog"
></script>
```

### Single class enrollment button
```html
<script
  src="https://portal.balletacademyandmovement.com/widget.js"
  data-tenant="TENANT_ID"
  data-mode="button"
  data-class-id="CLASS_ID"
  data-label="Enroll Now"
></script>
```

## Widget Modes

### wizard
Full enrollment wizard — age/experience quiz -> class
recommendations -> cart -> checkout -> confirmation.
Renders inline in the host page.

### catalog
Browse all classes with filters (age, day, discipline).
Click to add to cart -> checkout flow.

### button
Single "Enroll Now" button for a specific class.
Opens enrollment modal on click.

## Configuration Options (data attributes)

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| data-tenant | Yes | — | Tenant UUID |
| data-mode | No | wizard | wizard/catalog/button |
| data-primary-color | No | #9C8BBF | Brand color |
| data-font | No | system | Google Font name |
| data-class-id | button mode only | — | Specific class ID |
| data-label | button mode only | Enroll Now | Button text |
| data-lang | No | en | Language code |
| data-hide-contact | No | false | Hide contact bubble |

## Technical Architecture

### widget.js (the loader)
Lightweight (<5KB) script that:
1. Reads data-* attributes from script tag
2. Creates an isolated iframe OR shadow DOM container
3. Loads the full widget bundle inside isolation layer
4. Handles postMessage communication with host page
5. Resizes iframe to fit content (no scrollbars)

### Isolation Strategy: iframe (recommended)
- Widget renders inside a same-origin iframe
- src: /widget/[tenantId]?mode=wizard&color=...
- Parent page sends config via postMessage
- Widget sends events back (enrolled, cart_updated, etc.)
- iframe resizes dynamically via postMessage height updates
- Zero CSS conflicts with host site

### Alternative: Shadow DOM
- Widget renders in Shadow DOM for true CSS isolation
- More complex but no iframe loading overhead
- Better for performance, harder to implement

### Recommended: iframe approach for v1
Simple, reliable, works everywhere. Shadow DOM for v2.

## API Routes Needed

### GET /api/widget/config?tenant=UUID
Returns tenant config for the widget:
```json
{
  "tenantId": "string",
  "studioName": "string",
  "primaryColor": "string",
  "logoUrl": "string",
  "phone": "string",
  "email": "string",
  "stripePublishableKey": "string"
}
```

### GET /api/widget/classes?tenant=UUID
Returns active, enrollable classes for widget display.
No auth required — public endpoint.
Filters: age_min, age_max, discipline, day_of_week

### POST /api/widget/cart
Creates/updates cart for widget session.
Returns cartId for checkout.

### All existing /api/enrollment/* routes
Already work — widget uses same checkout/webhook flow.

## Widget Pages (new routes)

```
app/(widget)/widget/
├── [tenantId]/
│   ├── page.tsx          # Widget shell page (loaded in iframe)
│   ├── layout.tsx        # Minimal layout, no admin nav
│   ├── wizard/
│   │   └── page.tsx      # Enrollment wizard in widget context
│   ├── catalog/
│   │   └── page.tsx      # Class catalog in widget context
│   └── button/
│       └── page.tsx      # Single button + modal
```

## widget.js Implementation
```javascript
(function() {
  var script = document.currentScript;
  var tenant = script.getAttribute('data-tenant');
  var mode = script.getAttribute('data-mode') || 'wizard';
  var color = script.getAttribute('data-primary-color') || '';
  var container = document.getElementById('bam-enrollment');

  if (!container || !tenant) return;

  // Build iframe URL
  var base = 'https://portal.balletacademyandmovement.com';
  var params = new URLSearchParams({
    mode: mode,
    color: color,
    ref: window.location.hostname
  });
  var src = base + '/widget/' + tenant + '?' + params.toString();

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.style.cssText = [
    'width:100%',
    'border:none',
    'display:block',
    'min-height:600px',
    'transition:height 0.2s ease'
  ].join(';');

  container.appendChild(iframe);

  // Auto-resize
  window.addEventListener('message', function(e) {
    if (e.origin !== base) return;
    if (e.data.type === 'BAM_RESIZE') {
      iframe.style.height = e.data.height + 'px';
    }
    if (e.data.type === 'BAM_ENROLLED') {
      // Fire custom event for analytics
      container.dispatchEvent(new CustomEvent('bam:enrolled', {
        detail: e.data.payload
      }));
    }
  });
})();
```

## Events (postMessage from widget to host)

| Event | Payload | Description |
|-------|---------|-------------|
| BAM_RESIZE | { height: number } | Widget height changed |
| BAM_ENROLLED | { studentName, className, amount } | Enrollment complete |
| BAM_CART_UPDATED | { itemCount, total } | Cart changed |
| BAM_STEP_CHANGED | { step: string } | Wizard step changed |

Host page can listen:
```javascript
document.getElementById('bam-enrollment')
  .addEventListener('bam:enrolled', function(e) {
    // Track conversion in Google Analytics, etc.
    gtag('event', 'enrollment', { value: e.detail.amount });
  });
```

## WordPress Integration
1. Studio owner logs into BAM admin
2. Goes to Settings -> Website Widget
3. Copies embed code (pre-filled with their tenant ID)
4. Pastes into WordPress page using HTML block
5. Done — enrollment wizard appears on their site

## Security

### CORS
Widget API routes allow requests from:
- Registered domains per tenant (stored in tenant settings)
- widget.js validates origin against tenant's allowed_domains

### Tenant validation
All widget API routes validate tenant UUID exists and is active.
Rate limited per tenant to prevent abuse.

### Payment security
Stripe keys are never exposed in widget.js.
All payment processing happens server-side via existing
/api/enrollment/checkout route.

## Analytics & Tracking

Widget fires standard events compatible with:
- Google Analytics 4
- Meta Pixel
- Any GTM setup

Studio owners get enrollment analytics in their BAM dashboard.

## Settings Page
New page: /admin/settings/website-widget

Shows:
- Embed code generator (copy to clipboard)
- Preview of widget
- Allowed domains list (security)
- Widget customization: color, font, mode
- Analytics: views, starts, completions, conversion rate

## Build Plan (Priority Order)

### Phase 1 — iframe widget (MVP)
1. Create /widget/[tenantId] route + minimal layout
2. Adapt enrollment wizard for widget context
3. Build widget.js loader script
4. Build /api/widget/config and /api/widget/classes
5. Add auto-resize postMessage
6. Test on BAM WordPress site

### Phase 2 — Settings page
1. /admin/settings/website-widget page
2. Embed code generator
3. Allowed domains management
4. Widget preview

### Phase 3 — Analytics
1. Widget view/start/complete tracking
2. Conversion funnel in admin dashboard

### Phase 4 — Advanced modes
1. Catalog mode
2. Button/modal mode
3. Shadow DOM option

## Estimated Build Time
- Phase 1: 1 day
- Phase 2: 0.5 days
- Phase 3: 0.5 days
- Phase 4: 1 day
Total: ~3 days

## Dependencies
- Existing enrollment wizard
- Existing Stripe checkout
- Existing webhook handler
- New: widget.js loader
- New: /widget/[tenantId] route
- New: /api/widget/* public endpoints
