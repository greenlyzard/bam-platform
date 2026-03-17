import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  const supabase = await createClient();

  if (!["super_admin", "admin", "teacher"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ contacts: [] });
  }

  const pattern = `%${q}%`;

  // Search families
  const { data: families } = await supabase
    .from("families")
    .select("id, family_name, billing_email")
    .or(`family_name.ilike.${pattern},billing_email.ilike.${pattern}`)
    .limit(5);

  // Search leads
  const { data: leads } = await supabase
    .from("leads")
    .select("id, first_name, last_name, email")
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
    .limit(5);

  // Search staff profiles
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("role", ["super_admin", "admin", "teacher"])
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
    .limit(5);

  const contacts = [
    ...(families ?? []).map((f) => ({
      id: f.id,
      name: f.family_name ?? f.billing_email ?? "",
      email: f.billing_email ?? "",
      type: "family" as const,
    })),
    ...(leads ?? []).map((l) => ({
      id: l.id,
      name: [l.first_name, l.last_name].filter(Boolean).join(" ") || (l.email ?? ""),
      email: l.email ?? "",
      type: "lead" as const,
    })),
    ...(staff ?? []).map((s) => ({
      id: s.id,
      name: [s.first_name, s.last_name].filter(Boolean).join(" ") || (s.email ?? ""),
      email: s.email ?? "",
      type: "staff" as const,
    })),
  ].filter((c) => c.email);

  return NextResponse.json({ contacts });
}
