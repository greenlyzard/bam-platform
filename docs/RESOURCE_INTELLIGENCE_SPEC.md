# RESOURCE_INTELLIGENCE.md
# Ballet Academy and Movement — Resource Intelligence System
# Status: Ready to build
# Related: SCHEDULING_AND_LMS.md, CALENDAR_AND_SCHEDULING.md, CLASSES.md

---

## 1. Overview

The Resource Intelligence System gives Amanda a live view of how the studio's
three physical resources — Studio A, Studio B, Studio C — are being used across
the week, and surfaces AI-powered recommendations to:

- Fill enrollment gaps
- Balance teacher workloads
- Detect dead time blocks suitable for external room rental
- Optimize class scheduling to maximize revenue per square foot

This is not just a schedule viewer. It is an active intelligence layer that
notices patterns Amanda doesn't have time to notice manually.

---

## 2. Core Concepts

### Resources
Three rooms, each with distinct properties:

| Room     | Capacity (students) | Notes                        |
|----------|--------------------|-----------------------------|
| Studio A | 12                 | Main studio, sprung floor    |
| Studio B | 10                 | Mid-size, mirrors            |
| Studio C | 8                  | Smallest, used for privates  |

### Utilization
A room is considered:
- **Occupied** — a class or event is scheduled
- **Dead time** — no class scheduled, within studio open hours
- **Rental eligible** — dead time block ≥ 60 minutes with buffer on each side

### Teacher Load
Each teacher has:
- `max_hours_per_week` (set in profiles)
- Actual scheduled hours calculated from class instances
- Status: `underloaded` / `balanced` / `approaching_max` / `over_max`

---

## 3. Database Schema

### New Tables

```sql
-- Room rental inquiries and bookings
CREATE TABLE room_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  room_id uuid REFERENCES rooms(id),
  renter_name text NOT NULL,
  renter_email text NOT NULL,
  renter_phone text,
  renter_type text CHECK (renter_type IN (
    'yoga', 'pilates', 'fitness', 'dance', 'therapy', 'other'
  )),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  rate_per_hour numeric(8,2),
  total_amount numeric(8,2),
  status text DEFAULT 'inquiry' CHECK (status IN (
    'inquiry', 'confirmed', 'cancelled', 'completed'
  )),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- AI recommendations log
CREATE TABLE resource_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  recommendation_type text CHECK (recommendation_type IN (
    'fill_class', 'add_class', 'move_class', 'rental_opportunity',
    'teacher_load', 'room_conflict'
  )),
  title text NOT NULL,
  description text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'acted_on')),
  metadata jsonb DEFAULT '{}',
  generated_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  acted_on_at timestamptz,
  dismissed_at timestamptz
);

-- Studio open hours (when rooms are available at all)
CREATE TABLE studio_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
  open_time time NOT NULL,
  close_time time NOT NULL,
  is_closed boolean DEFAULT false
);
```

### Existing Tables Used
- `rooms` — Studio A, B, C (already seeded)
- `classes` — each class references a room and teacher
- `class_instances` — individual occurrences in the calendar
- `profiles` — teachers with max_hours_per_week
- `enrollments` — student count per class

---

## 4. Utilization Engine

### lib/resources/utilization.ts

Core functions:

```typescript
// Returns occupancy for every room, every hour, for a given week
getWeeklyUtilization(tenantId: string, weekStart: Date): Promise<UtilizationGrid>

// Returns dead time blocks per room
getDeadTimeBlocks(tenantId: string, weekStart: Date): Promise<DeadTimeBlock[]>

// Returns blocks eligible for rental (>= minDuration, with buffer)
getRentalEligibleBlocks(
  tenantId: string,
  weekStart: Date,
  minDurationMinutes?: number  // default 60
): Promise<RentalEligibleBlock[]>

// Returns teacher load summary for the current week
getTeacherLoadSummary(tenantId: string): Promise<TeacherLoad[]>

// Returns enrollment gaps (classes below capacity threshold)
getEnrollmentGaps(
  tenantId: string,
  capacityThreshold?: number  // default 0.5 = below 50% full
): Promise<EnrollmentGap[]>
```

### Types

```typescript
interface UtilizationGrid {
  weekStart: Date
  rooms: {
    room: Room
    slots: {
      dayOfWeek: number
      hour: number  // 0-23
      status: 'occupied' | 'dead_time' | 'closed' | 'rental_eligible'
      classInstance?: ClassInstanceSummary
      rental?: RoomRental
    }[]
    utilizationPercent: number  // 0-100
  }[]
}

interface DeadTimeBlock {
  room: Room
  start: Date
  end: Date
  durationMinutes: number
  isRentalEligible: boolean
}

interface TeacherLoad {
  teacher: TeacherProfile
  scheduledHours: number
  maxHours: number
  utilizationPercent: number
  status: 'underloaded' | 'balanced' | 'approaching_max' | 'over_max'
  classes: ClassSummary[]
}

interface EnrollmentGap {
  class: ClassSummary
  enrolled: number
  capacity: number
  fillPercent: number
  waitlistCount: number
  room: Room
  teacher: TeacherProfile
}
```

---

## 5. AI Recommendation Engine

### lib/resources/recommendations.ts

The recommendation engine runs on a cron (daily at 6am) and also on-demand
when Amanda opens the Resource Intelligence dashboard.

It queries the utilization engine and generates `resource_recommendations` rows.

### Recommendation Types

#### fill_class
Triggered when: a class is below 50% capacity AND there are students of the
right age/level not yet enrolled in any class at that time.

Example output:
> "Tuesday 4:00pm Petites Ballet (Studio B) is 3/10 full. 4 students aged 3-5
> are enrolled elsewhere but have no Tuesday class. Consider promoting this slot
> to their parents."

Metadata: `{ classId, enrolled, capacity, targetStudentIds[], suggestedAction: 'email_parents' }`

#### add_class
Triggered when: a room has a dead time block ≥ 90 minutes AND there is a
waitlist for any class of any level.

Example output:
> "Studio A is empty Wednesday 5:00–7:00pm. There are 6 students waitlisted for
> Intermediate Ballet. Adding a section here would fill immediately."

Metadata: `{ roomId, start, end, waitlistedLevel, waitlistCount }`

#### move_class
Triggered when: two classes are scheduled in different rooms at the same time,
one room is significantly larger, and moving would free a room for other use.

Example output:
> "Tuesday 5pm: Tiny Tots (8 students) is in Studio A (cap 12) while Studio C
> (cap 8) is empty. Moving Tiny Tots to Studio C frees Studio A for a larger
> class or rental."

Metadata: `{ classId, currentRoomId, suggestedRoomId, freedCapacity }`

#### rental_opportunity
Triggered when: a room has dead time ≥ 60 minutes on the same day/time for
3+ consecutive weeks (recurring availability).

Example output:
> "Studio B is consistently empty Monday 10am–12pm. This is a recurring 2-hour
> block. At $30/hr this would generate $240/month. Consider listing it for rent."

Metadata: `{ roomId, dayOfWeek, startTime, endTime, weeksConsistent, estimatedMonthlyRevenue }`

#### teacher_load
Triggered when: a teacher is at >90% of max_hours OR <40% of max_hours.

Example output:
> "Ally Helmen is scheduled for 14.5 of her 15 max hours this week. Adding more
> classes risks burnout. Consider cross-training another teacher for her level."

OR:

> "Campbell Castner is only scheduled for 4 hours this week (max 12). She has
> capacity for additional classes and may be at risk of leaving for more hours."

Metadata: `{ teacherId, scheduledHours, maxHours, utilizationPercent }`

---

## 6. Admin UI

### /admin/resources — Main Dashboard

Three-panel layout:

**Panel 1: Weekly Room Grid**
- X axis: days of week (Mon–Sun)
- Y axis: hours (studio open hours only, e.g. 3pm–9pm weekdays, 9am–5pm weekends)
- Each cell: color-coded by status
  - 🟣 Lavender — occupied (class scheduled)
  - ⬜ White — dead time
  - 🟡 Amber — rental eligible
  - ⬛ Gray — outside studio hours
- Click any cell to see class details or mark as rental eligible

**Panel 2: AI Recommendations Feed**
- Sorted by priority (high → medium → low)
- Each card shows: type badge, title, description, suggested action button
- Actions: "Dismiss", "Mark as Done", "Take Action" (links to relevant admin page)
- Dismissing asks: "Remind me in 1 week / Don't show again"

**Panel 3: Teacher Load Summary**
- List of all active teachers
- Mini bar showing hours / max hours
- Color: green (balanced), yellow (approaching max), red (over max), gray (underloaded)
- Click teacher → goes to their schedule view

### /admin/resources/rentals — Room Rental Manager

- List of all rental inquiries and bookings
- Filter by: room, status, date range
- Create new rental manually
- Each rental shows: renter name, room, time, amount, status
- Status flow: inquiry → confirmed → completed / cancelled
- "Available Blocks" tab — shows all rental-eligible blocks for next 4 weeks
  with one-click "Create Rental" button

### /admin/resources/settings — Configuration

- Set studio open hours per day
- Set max_hours_per_week per teacher
- Set rental rate per room (default $/hr)
- Set capacity thresholds for recommendations
- Enable/disable recommendation types

---

## 7. API Routes

```
GET  /api/admin/resources/utilization?week=2026-03-16
     → Returns UtilizationGrid for the given week

GET  /api/admin/resources/dead-time?week=2026-03-16
     → Returns DeadTimeBlock[]

GET  /api/admin/resources/rental-eligible?week=2026-03-16&minDuration=60
     → Returns RentalEligibleBlock[]

GET  /api/admin/resources/teacher-load
     → Returns TeacherLoad[] for current week

GET  /api/admin/resources/recommendations?status=active
     → Returns active resource_recommendations[]

POST /api/admin/resources/recommendations/[id]/dismiss
     → Updates status to dismissed

POST /api/admin/resources/recommendations/[id]/act
     → Updates status to acted_on

POST /api/admin/resources/recommendations/generate
     → Triggers on-demand recommendation generation

GET  /api/admin/rentals
     → Returns room_rentals[]

POST /api/admin/rentals
     → Creates new rental inquiry

PATCH /api/admin/rentals/[id]
     → Updates rental status / details
```

---

## 8. Cron Job

```typescript
// app/api/cron/resource-recommendations/route.ts
// Runs daily at 6:00am via Vercel Cron

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Get all active tenants
  // For each tenant, run recommendation engine
  // Insert new recommendations (skip duplicates)
  // Delete expired recommendations
  // Return summary
}
```

Add to vercel.json:
```json
{
  "crons": [
    {
      "path": "/api/cron/resource-recommendations",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Add to .env.local and Vercel:
```
CRON_SECRET=generate-a-random-string
```

---

## 9. Room Rental Pricing Logic

Default pricing suggestion (configurable in settings):

| Room     | Suggested Rate |
|----------|---------------|
| Studio A | $40/hr        |
| Studio B | $30/hr        |
| Studio C | $20/hr        |

The AI recommendation will calculate estimated monthly revenue for recurring
dead blocks automatically using these rates.

---

## 10. Acceptance Criteria

1. Weekly room grid renders correctly for all 3 studios showing occupied/dead/rental cells
2. Dead time blocks are accurately calculated from class_instances vs studio_hours
3. Rental-eligible blocks filter correctly (>= 60 min, within open hours)
4. AI generates at least one recommendation when test data has an obvious gap
5. Recommendations can be dismissed or marked as acted on
6. Teacher load bars are accurate against actual scheduled hours
7. Room rental inquiry can be created manually and status updated
8. Cron route is protected and returns 401 without CRON_SECRET
9. All routes return 403 for non-admin roles
10. npx tsc --noEmit passes clean

---

## 11. Claude Code Prompt

Paste into a fresh Claude Code session:

---

```
Read docs/claude/RESOURCE_INTELLIGENCE.md carefully.
Also read docs/claude/CLASSES.md and docs/claude/CALENDAR_AND_SCHEDULING.md for context
on how rooms, teachers, and class_instances are structured.

Then audit the existing schema:
1. Read supabase/migrations/ to understand rooms, classes, class_instances, enrollments, profiles tables
2. Check if studio_hours table exists — if not, it needs to be created
3. Check if resource_recommendations and room_rentals tables exist — create if not

Then build in this order:
1. Migration: studio_hours, resource_recommendations, room_rentals tables + seed BAM studio hours (Mon-Fri 3pm-9pm, Sat 9am-5pm, Sun closed)
2. lib/resources/utilization.ts — all core functions
3. lib/resources/recommendations.ts — recommendation engine
4. API routes (utilization, dead-time, rental-eligible, teacher-load, recommendations, rentals)
5. Admin UI: /admin/resources (grid + recommendations + teacher load)
6. Admin UI: /admin/resources/rentals
7. Admin UI: /admin/resources/settings
8. Cron route + vercel.json entry
9. Add resource nav link to admin-nav.tsx

Run npx tsc --noEmit when done.
Commit: "feat: resource intelligence system — room utilization, AI recommendations, rental manager"
```
