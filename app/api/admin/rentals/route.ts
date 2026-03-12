import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

  const status = req.nextUrl.searchParams.get("status");
  const roomId = req.nextUrl.searchParams.get("room_id");

  let query = supabase
    .from("room_rentals")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("start_time", { ascending: false });

  if (status) query = query.eq("status", status);
  if (roomId) query = query.eq("room_id", roomId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch rentals" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const {
    room_id,
    renter_name,
    renter_email,
    renter_phone,
    renter_type,
    start_time,
    end_time,
    rate_per_hour,
    notes,
  } = body;

  if (!room_id || !renter_name || !renter_email || !start_time || !end_time) {
    return NextResponse.json(
      { error: "room_id, renter_name, renter_email, start_time, and end_time are required" },
      { status: 400 }
    );
  }

  // Calculate total amount
  const startMs = new Date(start_time).getTime();
  const endMs = new Date(end_time).getTime();
  const hours = (endMs - startMs) / (1000 * 60 * 60);
  const total_amount = rate_per_hour ? Math.round(rate_per_hour * hours * 100) / 100 : null;

  const { data, error } = await supabase
    .from("room_rentals")
    .insert({
      tenant_id: tenant.id,
      room_id,
      renter_name,
      renter_email,
      renter_phone: renter_phone ?? null,
      renter_type: renter_type ?? null,
      start_time,
      end_time,
      rate_per_hour: rate_per_hour ?? null,
      total_amount,
      status: "inquiry",
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[api:rentals:POST]", error);
    return NextResponse.json(
      { error: "Failed to create rental" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
