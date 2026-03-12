# BAM Portal Features
## docs/claude/PORTAL_FEATURES.md — What Each User Role Can Do

---

## Overview

The BAM platform has three portal contexts, each with different views and capabilities. Angelina adapts her responses based on which portal a user is in — she knows what that person can see and do, and guides them accordingly rather than describing features they don't have access to.

---

## Parent Portal (`/portal`)

Parents log in with the email used during enrollment. A parent account can have multiple students attached.

### Dashboard
- View all enrolled students and their current classes
- See upcoming rehearsals and performances across all children
- Account balance and payment status
- Announcements from BAM (studio-wide and class-specific)
- Quick links to most-used features

### Schedule (`/portal/schedule`)
- Full weekly schedule for each enrolled student
- Class details: teacher, room, time, what to bring/wear
- Rehearsal overlays showing extra sessions on top of regular classes
- iCal/Google Calendar export per student
- Makeup class requests (limit: 1 per month per class)

### Enrollment (`/portal/enroll`)
- Browse available classes filtered by student's age and current level
- Add/remove classes (subject to approval for level changes)
- View class capacity and waitlist status
- Request a level change or placement assessment
- Cannot self-enroll in: Competition, Pointe (requires teacher approval)

### Performances & Casting (`/portal/performances`)
- View student's roles in current productions
- Rehearsal schedule with arrival times and location
- Costume information and notes (when published by admin)
- Performance event dates, venue, ticket info
- Digital cast list for their student only (not other families)

### Billing (`/portal/billing`)
- Current month's charges with itemized breakdown
- Discount line items shown prominently ("You saved $X this month")
- Payment history (12 months)
- Upcoming charges preview
- Annual savings summary
- Update payment method
- Download invoices as PDF

### Communications (`/portal/messages`)
- Messages from BAM staff and teachers
- Studio-wide announcements
- Class-specific notices
- Cannot initiate direct messages to teachers (use email: dance@bamsocal.com)

### Student Profile (`/portal/students/[id]`)
- Student's basic info (name, birthdate, allergies/medical notes)
- Current level and enrollment history
- Attendance record
- Performance history
- Apparel sizes on file

---

## Student Portal (`/portal/student`)

Students 13+ can have their own login linked to their parent account.

### What Students Can See (Same as Parent, Plus:)
- Their own schedule in a mobile-friendly view
- Cast list with all roles for productions they're in
- Personal rehearsal schedule with countdown timers
- Music/costume status for their roles
- Class notes from teachers (when teachers post them)

### What Students Cannot See
- Billing information
- Other students' casting or personal data
- Sibling's information (even with same parent account)

---

## Teacher Portal (`/portal/teacher`)

Teachers have separate login credentials managed by admin.

### My Classes (`/portal/teacher/classes`)
- Full roster for each assigned class
- Student photos and notes
- Attendance tracking (mark present/absent/late)
- Student skill notes (private to teachers + admin)
- Class schedule for current week

### Rehearsals (`/portal/teacher/rehearsals`)
- Upcoming rehearsals I'm leading
- Roster for each rehearsal
- Conflict alerts (students double-booked)
- Mark attendance for rehearsal

### Casting (`/portal/teacher/casting`)
- View cast for productions they're involved in
- See which of their students have roles
- Cannot edit casting (admin only)

### Communications (`/portal/teacher/messages`)
- Send announcements to a class (goes to all parents in that class)
- View parent messages routed through admin
- Cannot see billing information for any student

---

## Admin Portal (`/admin`)

Full access — not described here. See STACK.md for admin route structure.

---

## Angelina in the Portal

When Angelina is used in the portal context, she knows:
- Which portal the user is in (parent/student/teacher)
- The specific student(s) they're viewing
- Their enrolled classes, upcoming rehearsals, and balance

### What Angelina Should and Shouldn't Do in Each Context

**Parent portal:**
- ✅ Answer "When is Sofia's next rehearsal?" from injected context
- ✅ Guide to the right portal page ("You can find that at /portal/billing")
- ✅ Explain what a discount means on their invoice
- ✅ Help understand a level recommendation
- ❌ Do not discuss other families' students
- ❌ Do not make enrollment changes directly — guide to /portal/enroll
- ❌ Do not discuss casting decisions or why a student was/wasn't cast

**Student portal:**
- ✅ Answer questions about their own schedule and roles
- ✅ Help them understand what to bring to a rehearsal
- ✅ Explain what a costume note means
- ❌ Do not discuss billing
- ❌ Do not discuss other students

**Teacher portal:**
- ✅ Answer "Who's in my 3B ballet today?"
- ✅ Help draft a parent communication
- ✅ Summarize which of their students have upcoming rehearsals
- ✅ Flag if a student has a note on file
- ❌ Do not discuss any student's billing or family account

---

## Key Portal URLs (for Angelina to reference)

| Feature | URL |
|---------|-----|
| Dashboard | /portal |
| Schedule | /portal/schedule |
| Enroll | /portal/enroll |
| Billing | /portal/billing |
| Performances | /portal/performances |
| Messages | /portal/messages |
| Student profile | /portal/students/[id] |
| Teacher classes | /portal/teacher/classes |
| Admin dashboard | /admin |
| Admin casting | /admin/casting |
| Admin students | /admin/students |
| Admin settings/theme | /admin/settings/theme |

---

## Feature Availability by Build Phase

| Feature | Status |
|---------|--------|
| Parent dashboard | 🔲 In progress (registration flow building now) |
| Schedule view | 🔲 Pending |
| Enrollment cart | 🔲 Pending |
| Billing / invoices | 🔲 Pending |
| Casting / performances | 🔲 Pending (casting module spec complete) |
| Teacher portal | 🔲 Pending |
| Student portal | 🔲 Pending |
| Admin dashboard | ✅ Base built |
| Admin theme settings | ✅ Built |

---

*Last updated: March 2026 | Ballet Academy and Movement*
