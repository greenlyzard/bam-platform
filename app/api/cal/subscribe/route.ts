import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

const BASE_URL = "https://portal.balletacademyandmovement.com";
const TENANT_ID = "84d98f72-c82f-414f-8b17-172b802f6993";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Check for existing active subscription
  const { data: existing } = await admin
    .from("calendar_subscriptions")
    .select("id, subscription_token")
    .eq("user_id", user.id)
    .maybeSingle();

  let token: string;

  if (existing) {
    token = existing.subscription_token;
  } else {
    token = crypto.randomUUID();
    const { error } = await admin.from("calendar_subscriptions").insert({
      user_id: user.id,
      tenant_id: TENANT_ID,
      subscription_token: token,
      scope: { type: "teacher_schedule" },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const feedUrl = `${BASE_URL}/api/calendar/teacher/${user.id}/${token}`;
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`;
  const outlookUrl = `https://outlook.live.com/calendar/0/addevent?url=${encodeURIComponent(feedUrl)}`;

  return NextResponse.json({ token, feedUrl, googleUrl, outlookUrl });
}
