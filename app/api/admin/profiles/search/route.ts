import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (!["super_admin", "admin", "teacher"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ profiles: [] });
  }

  const supabase = await createClient();
  const pattern = `%${q}%`;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role")
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
    .limit(20);

  const results = (profiles ?? [])
    .filter((p) => p.email)
    .map((p) => ({
      id: p.id,
      name:
        [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "",
      email: p.email,
      role: p.role ?? "parent",
    }));

  return NextResponse.json({ profiles: results });
}
