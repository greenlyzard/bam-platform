import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  await requireAuth();
  const supabase = await createClient();
  const productionId = req.nextUrl.searchParams.get("production_id");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  let query = supabase
    .from("rehearsals")
    .select("*, productions(name)")
    .eq("tenant_id", tenant?.id ?? "")
    .order("date")
    .order("start_time");

  if (productionId) {
    query = query.eq("production_id", productionId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rehearsals: data ?? [] });
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const supabase = await createClient();
  const body = await req.json();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  const { data, error } = await supabase
    .from("rehearsals")
    .insert({
      tenant_id: tenant?.id,
      production_id: body.production_id || null,
      title: body.title,
      date: body.date,
      start_time: body.start_time,
      end_time: body.end_time,
      location: body.location || null,
      cast_groups: body.cast_groups || [],
      notes: body.notes || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
