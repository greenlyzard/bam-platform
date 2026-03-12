import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getRentalEligibleBlocks } from "@/lib/resources/utilization";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 500 });
  }

  const weekParam = req.nextUrl.searchParams.get("week");
  const minDuration = parseInt(
    req.nextUrl.searchParams.get("minDuration") ?? "60",
    10
  );

  const weekStart = weekParam ? new Date(weekParam) : new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const blocks = await getRentalEligibleBlocks(
    tenant.id,
    weekStart,
    minDuration
  );

  return NextResponse.json({ data: blocks });
}
