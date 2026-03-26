import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { subscription, deviceType, deviceName, tenantId } = body;

  // subscription has: endpoint, keys.p256dh, keys.auth
  await supabase.from("push_subscriptions").upsert(
    {
      tenant_id: tenantId,
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      device_type: deviceType ?? "web",
      device_name: deviceName ?? null,
      is_active: true,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" }
  );

  return NextResponse.json({ ok: true });
}
