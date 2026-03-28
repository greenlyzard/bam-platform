import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { color } = await req.json();
    if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get current palette
    const { data } = await admin
      .from("studio_settings")
      .select("custom_colors")
      .single();

    const current = (data?.custom_colors as Record<string, unknown>) ?? {};
    const palette: string[] = (current.class_palette as string[]) ?? [];

    if (palette.includes(color)) {
      return NextResponse.json({ ok: true, palette });
    }

    const updated = [...palette, color];

    await admin
      .from("studio_settings")
      .update({
        custom_colors: { ...current, class_palette: updated },
      })
      .eq("id", "807cadc5-405f-4d24-9225-ae8458a31577");

    return NextResponse.json({ ok: true, palette: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
