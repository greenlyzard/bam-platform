# Classes & Resources — Spec

**Status:** Pre-spec — ready for implementation  
**Phase:** 2 — Internal Operations  
**Related Modules:** CALENDAR_AND_SCHEDULING.md, CLASSES.md, SCHEDULING_AND_LMS.md, REGISTRATION_AND_ONBOARDING.md

---

## 1. Resource Management

### Resource Types
| Type | Examples |
|---|---|
| Room | Studio 1, Studio 2, Lobby, Green Room, Waiting Area |
| Equipment | Sound system, Marley floor, Portable barres, Mirrors, Props, Projector |
| Other | Parking lot, Changing room, Photo area |

### Resource Schema (new table: `class_resources`)
- id, tenant_id, name, type (room / equipment / other), description, is_active, color (for calendar), capacity (optional), sort_order

### Class-Resource Assignment
- Many-to-many: a class can use multiple resources
- New junction table: `class_resource_assignments` (class_id, resource_id, tenant_id)
- Admin assigns resources to a class via multi-select in the class edit drawer
- Resource conflicts flagged when two classes claim the same room at the same time

### Resource Conflict Detection
- On save: check if any assigned room resource overlaps with another class in the same time slot
- Warning with override — not a hard block
- Warning message: "Studio 1 is already assigned to [Class Name] at this time"
- Admin confirms override to proceed
- Room capacity warning: if class enrollment count meets or exceeds room capacity, admin is warned

---

## 2. Class List View

### Configurable Columns
- Admin can add/remove columns from the class list view
- Available columns: Name, Day, Start Time, End Time, Duration, Room, Teacher, Level, Style, Enrolled / Capacity, Season, Program Type, Status, Age Range, Price, Banner Image
- Default columns: Name, Day, Start Time, Room, Teacher, Enrolled/Capacity, Status
- Column order: drag to reorder

### Saved Views
- Admin can save a named view configuration (column selection + sort + filters)
- Views saved per user by default
- Admins can share views with other admins on the same tenant — shared views appear in a "Shared Views" section separate from "My Views"
- Only Studio Admin and above can share views
- Saved embed configurations follow the same sharing rules as saved views
- "Default View" can be pinned — loads automatically when admin opens Classes
- Views listed in a dropdown at top of page
- Views can be renamed or deleted

### Filters (persistent per saved view)
- Season, Program Type, Day of Week, Teacher, Room, Level, Style, Age Range, Status (active/inactive)
- Active filters shown as dismissible chips above the table

---

## 3. Calendar View — Room-Based Layout

### Room View
- Calendar displays classes as blocks on a grid: rooms on the Y axis, time on the X axis
- Each room gets a color-coded column
- Classes shown as colored blocks within their room column at their scheduled time
- Blocks show: class name, teacher, enrolled count
- Click a block to open class detail drawer

### Drag-to-Reschedule
- Available in Day view, Week view, and Month view
- Studio Admin and Studio Manager (if permission granted) can drag class blocks to reschedule
- Dragging updates: day_of_week, start_time, end_time
- On drop: resource conflict check fires automatically
- Warning shown if room conflict detected — admin confirms or cancels
- After successful reschedule: admin is prompted "Would you like to notify enrolled families?"
- Prompt pre-populates a draft message with: class name, old time, new time
- Notification is NOT sent automatically — admin reviews and sends manually
- Change logged in class audit history (admin-only — not visible to teachers)

### View Types
- List View (default)
- Calendar — Day layout: all rooms on Y axis, time on X axis
- Calendar — Week layout: one room or all rooms, full week
- Calendar — Month layout: dot/count indicator per day — click to expand and see class details
- Admin can set default view preference (saved with user preferences)

---

## 4. Class Banner Image & Logo

### Image Types
| Type | Dimensions | Usage |
|---|---|---|
| Square Icon | 400x400px | Class card thumbnail, parent portal, embed widget card |
| Banner | 1920x1080px | Print programs, marketing pages, website schedule sections |

### Storage
- Images stored in Supabase Storage bucket: `class-banners`
- Upload via admin class edit drawer
- Supported formats: JPG, PNG, WebP
- Both image types are optional — classes appear in all views regardless of whether images are set
- When no image is set: show placeholder with class initial / program type color

### Usage
- Parent portal: class card thumbnail (square icon preferred)
- iFrame embed widget: class listing card (square icon preferred, banner as fallback)
- Print programs: class header image (banner preferred)
- Marketing pages: auto-pulled when admin embeds a class schedule section

---

## 5. iFrame Embed Widget — Enhanced

### Changes from Current State
- Remove period and year filters from embed builder UI
- Add Room filter (show only classes in selected room)
- Add Teacher filter
- Add Season filter (select which active season to display)
- Add Dark mode variant toggle
- Add Custom color overrides

### Filter-to-Embed Flow
- Admin applies filters in Classes list view
- Clicks "Generate Embed" button
- Embed builder opens pre-filled with current filter state
- Admin can adjust before copying
- Embed code includes: season_id, program_type, room_ids (optional), teacher_ids (optional), day_of_week (optional), theme (light/dark/custom)

### Theme & Color Options
| Option | Description |
|---|---|
| Light | Default — cream background, charcoal text, lavender accents |
| Dark | Dark background, light text, muted borders |
| Custom | Admin sets: background color, text color, accent color, card color |

- Custom colors validated for accessibility — contrast ratio warning shown if combination fails WCAG AA
- Custom colors saved with the embed configuration
- Preview updates in real time as colors are adjusted

### Saved Embed Configurations
- Admin can save named embed configurations (e.g. "Monday Classes Widget", "Studio 1 Schedule")
- Saved configs are shareable between admins on the same tenant (same rules as saved views)
- Saved configs listed in embed builder for quick access
- Editing a saved config regenerates the embed code

---

## 6. Print-Ready Schedule

- From the filtered class list view, admin can export a print-ready PDF schedule
- PDF uses class banner images (1920x1080) if available
- PDF layout: one page per day, or compact multi-day grid
- Includes: class name, time, room, teacher, age range, level
- Branding: studio logo, season name, colors from brand settings
- Generated via existing PDF infrastructure (see CASTING_AND_REHEARSAL.md)

---

## 7. Decisions Log

| # | Decision |
|---|----------|
| 1 | Resource conflicts: warning with override — not a hard block |
| 2 | Room capacity: warning when enrollment meets or exceeds room capacity |
| 3 | Saved views: shareable between Studio Admin and above on the same tenant |
| 4 | Saved embed configs: shareable between admins on same tenant (same rules as views) |
| 5 | Drag-to-reschedule: available in Day, Week, and Month views |
| 6 | Drag-to-reschedule permissions: Studio Admin, and Studio Manager if permission granted |
| 7 | Class audit/reschedule history: admin-only — not visible to teachers |
| 8 | Reschedule notification: not automatic — admin prompted with pre-populated draft message (class name, old time, new time) |
| 9 | Banner images: optional — two sizes: 400x400 square icon and 1920x1080 banner |
| 10 | Month calendar view: dot/count indicator per day — click to expand |
| 11 | Custom embed colors: validated for accessibility with WCAG AA contrast ratio warning |
| 12 | Embed widget: light/dark toggle plus full custom color overrides |
