import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/guards";

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (
    !user ||
    !["super_admin", "admin", "front_desk"].includes(user.role)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const leadsOnly = url.searchParams.get("leads") === "true";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "20", 10),
    50
  );
  const offset = (page - 1) * limit;

  let query = supabase
    .from("angelina_conversations")
    .select("id, session_id, role, lead_name, lead_email, lead_child_age, lead_child_name, lead_converted, messages, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (role) {
    query = query.eq("role", role);
  }

  if (leadsOnly) {
    query = query.not("lead_email", "is", null);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[angelina/conversations] Query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }

  // Add message counts
  const conversations = (data ?? []).map((c) => ({
    ...c,
    messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
    messages: undefined, // Don't send full messages in list view
  }));

  return NextResponse.json({
    conversations,
    total: count ?? 0,
    page,
    limit,
  });
}
