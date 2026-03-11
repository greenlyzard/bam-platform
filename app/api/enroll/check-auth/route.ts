import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  // Fetch existing students for this parent
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("parent_id", user.id)
    .eq("active", true)
    .order("first_name");

  return NextResponse.json({
    authenticated: true,
    students: students ?? [],
  });
}
