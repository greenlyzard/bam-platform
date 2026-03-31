Create docs/UNIFIED_SCHEDULE.md with this content:

# Unified Schedule — BAM Platform Spec

## Overview
Replace the separate /admin/classes and /admin/schedule pages with 
a single unified Schedule page at /admin/schedule (redirect 
/admin/classes to /admin/schedule).

## URL Structure
- /admin/schedule — main unified schedule page
- /admin/schedule?view=calendar — room sub-column calendar view
- /admin/schedule?view=week — simple week card view  
- /admin/schedule?view=list — sortable list view
- /admin/schedule?view=room — room-focused view
- /admin/classes — 301 redirect to /admin/schedule

## Navigation
- Sidebar item renamed from "Classes" to "Schedule"
- "Classes" sub-item removed
- Schedule becomes the single entry point for all class + private management

## Views

### List View (from current /admin/classes)
- All existing columns, sorting, filtering
- Column picker with drag-to-reorder
- My Classes filter pill
- Inline edit drawer
- Bulk actions (future)

### Room Calendar View (from current /admin/classes Calendar tab)
- Room sub-columns per day (Studio 1/2/3/Pilates Room)
- Frozen headers and time column
- Color coded by class color_hex or level
- Discipline icons on event blocks
- Field picker (time, name, teacher, levels, room, enrolled)
- Week navigation
- Double booking detection
- Studio closure overlays
- Add to Calendar per event
- Print mode

### Simple Week View (from current /admin/schedule Week view)
- 6-column grid (Mon-Sat)
- SessionCard per class: time, teacher, room, level badge
- Filters: Teacher, Level, Room, Day
- Click to open edit drawer
- Closure banners per day

### Room View
- Rooms as rows, time as columns
- Shows what's happening in each room at each time
- Good for resource planning

## Privates Integration

### Toggle
- "Show Privates" pill button in filter bar (default: off)
- Persisted to localStorage as 'bam-schedule-show-privates'
- When ON: private sessions appear in all views

### Visual Treatment
- Purple background (#F3E8FF)
- Purple left border (3px solid #A855F7)
- "PRIVATE" badge
- Dashed border style

### Privates Dashboard Bar
- Visible only when privates toggle is ON
- Shows: Privates This Week | Pending Billing | This Month | Revenue MTD
- Links to /admin/privates for full management

## Filters (unified across all views)
- Teacher (multi-select)
- Level (multi-select, dynamic from DB)
- Room (multi-select)
- Day of week
- Discipline
- Status (Active/Inactive/All)
- Season
- My Classes (pill, only for teacher-role users)
- Show Privates (pill toggle)

## Stats Bar (top of page)
- Active Classes count
- Total Enrolled (when enrollment data exists)
- At Capacity count
- Open Spots
- + Privates This Week (when privates toggle ON)
- + Pending Billing (when privates toggle ON)

## Canva Integration
- "Export to Canva" button in top right
- Opens modal with template options:
  - Weekly Schedule (all classes by day)
  - Room Schedule (by studio)
  - Teacher Schedule (filtered to one teacher)
  - Parent-Facing Schedule (public version)
- Pushes current filtered view data to selected Canva template
- Uses Canva MCP connection already configured

## Data Sources
- classes table (with class_teachers, rooms, disciplines joins)
- private_sessions (when privates toggle ON)
- studio_closures (always)
- teacher_availability (future)

## Migration Plan
1. Build unified page at /admin/schedule (new file)
2. Move all classes page functionality into it
3. Add simple week view from schedule page
4. Add privates toggle + dashboard bar
5. Add Canva export
6. Add redirect from /admin/classes to /admin/schedule
7. Update sidebar nav

## Component Structure
app/(admin)/admin/schedule/
  page.tsx — server component, fetches all data
  schedule-client.tsx — main client component with view switcher
  views/
    ListView.tsx — from class-management.tsx list view
    RoomCalendarView.tsx — from class-management.tsx renderCalendar()
    WeekView.tsx — from schedule-calendar.tsx week view
    RoomView.tsx — from schedule-calendar.tsx room view
  components/
    FilterBar.tsx — unified filters
    StatsBar.tsx — top stats
    PrivatesDashboard.tsx — privates stats bar
    EventBlock.tsx — shared event rendering
    SessionCard.tsx — from schedule-calendar.tsx
    ClassEditDrawer.tsx — existing edit drawer
  
## Files to Deprecate (after migration)
- app/(admin)/admin/classes/ — redirect to /admin/schedule
- app/(admin)/admin/schedule/schedule-calendar.tsx — merge into views/

## Open Questions
- Should /admin/privates stay separate or merge into Schedule?
  Recommendation: Keep separate for billing/approval workflows,
  but show privates data in Schedule when toggle is ON.
- Should teachers see this unified view or just /teach/schedule?
  Recommendation: Teachers use /teach/schedule (simpler view).
  Admins use /admin/schedule (full unified view).

## Priority Order
1. Rename nav + redirect /admin/classes → /admin/schedule
2. Add privates toggle to existing classes calendar
3. Add simple week view tab to classes calendar  
4. Build unified stats bar with privates data
5. Add Canva export
6. Full component extraction (future cleanup)

Save the file and confirm it was created.