import { NextRequest, NextResponse } from "next/server";
import { searchFamiliesForEnrollment } from "@/lib/queries/families";
import { getUser } from "@/lib/auth/guards";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (
    !user ||
    !["admin", "super_admin", "studio_admin", "finance_admin", "studio_manager"].includes(
      user.role
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const families = await searchFamiliesForEnrollment(q);
  return NextResponse.json(families);
}
