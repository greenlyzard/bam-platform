import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ closure: null });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("studio_closures")
    .select("id, closed_date, reason")
    .eq("closed_date", date)
    .eq("tenant_id", "84d98f72-c82f-414f-8b17-172b802f6993")
    .maybeSingle();

  return NextResponse.json({ closure: data ?? null });
}
