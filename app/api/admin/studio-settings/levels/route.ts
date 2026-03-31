import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STUDIO_SETTINGS_ID = "807cadc5-405f-4d24-9225-ae8458a31577";

export async function POST(req: Request) {
  try {
    const { levels } = await req.json();
    if (!Array.isArray(levels)) {
      return NextResponse.json({ error: "Invalid levels" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data } = await admin
      .from("studio_settings")
      .select("custom_colors")
      .single();

    const current = (data?.custom_colors as Record<string, unknown>) ?? {};

    await admin
      .from("studio_settings")
      .update({
        custom_colors: { ...current, level_list: levels },
      })
      .eq("id", STUDIO_SETTINGS_ID);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
