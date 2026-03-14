import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";

const TENANT_ID = "84d98f72-c82f-414f-8b17-172b802f6993";

export async function GET() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("tenants")
    .select("angelina_enabled")
    .eq("id", TENANT_ID)
    .single();

  return NextResponse.json({ enabled: data?.angelina_enabled ?? true });
}

export async function POST(req: NextRequest) {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { enabled } = await req.json();

  const { error } = await supabase
    .from("tenants")
    .update({ angelina_enabled: !!enabled })
    .eq("id", TENANT_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, enabled: !!enabled });
}
