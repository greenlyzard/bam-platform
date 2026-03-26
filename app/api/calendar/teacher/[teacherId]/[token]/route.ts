import { NextRequest, NextResponse } from "next/server";

// Placeholder for Phase 5 — Teacher iCal calendar feed
// This endpoint will generate an iCal (.ics) feed of a teacher's private sessions
// using the ical_uid field on each private_sessions row.
// Token-based auth (no login required) for calendar app subscriptions.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teacherId: string; token: string }> }
) {
  const { teacherId, token } = await params;

  return NextResponse.json(
    {
      error: "Not Implemented",
      message: "Calendar sync coming soon. This endpoint will provide an iCal feed for teacher private lesson schedules.",
      teacherId,
      token,
    },
    { status: 501 }
  );
}
