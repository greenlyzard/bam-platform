import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function PUT(req: NextRequest) {
  const user = await requireAuth();
  const supabase = await createClient();
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (body.first_name !== undefined) updates.first_name = body.first_name;
  if (body.last_name !== undefined) updates.last_name = body.last_name;
  if (body.preferred_name !== undefined) updates.preferred_name = body.preferred_name;
  if (body.phone !== undefined) updates.phone = body.phone;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
