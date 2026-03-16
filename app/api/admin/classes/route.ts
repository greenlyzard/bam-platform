import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, start_time, end_time")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("[api/admin/classes]", error);
    return NextResponse.json(
      { error: "Failed to fetch classes" },
      { status: 500 }
    );
  }

  return NextResponse.json({ classes: classes ?? [] });
}
