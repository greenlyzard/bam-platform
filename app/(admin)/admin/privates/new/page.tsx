import { requireAdmin } from "@/lib/auth/guards";
import Link from "next/link";
import { tenantToday } from "@/lib/dates";
import { NewPrivateClient } from "./new-private-client";

// Prefill transport for "add a private from the Calendar"
// (PRIVATE_ADD_FROM_CALENDAR.md §4): query params on this existing route, read
// here and handed to the existing form as initial state. Nothing about the route
// or the form changes when they are absent.
//
// Both patterns are validated before use — a query param is user input, and a
// malformed one would seed a date/time input with a value it cannot represent.
// An unparseable param is dropped, not corrected.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default async function NewPrivatePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    start?: string;
    studio?: string;
    location_id?: string;
  }>;
}) {
  const user = await requireAdmin();
  const params = await searchParams;

  // No `date` param means the admin came straight to the form, so it opens on
  // today — today *in the studio's timezone* (TENANT_TIMEZONE_SPEC.md §4.2), not
  // the browser's and not the server's UTC. The form's own `todayStr()` fallback
  // is the browser's date and is only reached by callers that cannot know the
  // tenant zone.
  const date = params.date && DATE_RE.test(params.date) ? params.date : tenantToday(user.timezone);
  const start = params.start && TIME_RE.test(params.start) ? params.start : undefined;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/privates"
          className="text-sm text-lavender hover:text-lavender-dark"
        >
          &larr; Back to Privates
        </Link>
        <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
          Book Private Session
        </h1>
        <p className="mt-1 text-sm text-slate">
          Schedule a new private lesson for a student.
        </p>
      </div>
      <NewPrivateClient
        tenantId={user.tenantId!}
        initialDate={date}
        initialStartTime={start}
        initialStudio={params.studio || undefined}
        initialLocationId={params.location_id || undefined}
      />
    </div>
  );
}
