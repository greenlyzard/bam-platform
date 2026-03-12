import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { actOnRecommendation } from "@/lib/resources/recommendations";

export async function POST(
  _req: Request,
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
  const result = await actOnRecommendation(id);

  if (!result.success) {
    return NextResponse.json(
      { error: "Failed to update recommendation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
