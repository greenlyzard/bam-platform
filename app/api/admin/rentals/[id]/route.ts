import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const body = await req.json();

  const { data, error } = await supabase
    .from("room_rentals")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[api:rentals:PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update rental" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}
