import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/admin/dashboard";

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/login?error=missing_params", request.url)
    );
  }

  console.log("[callback] token_hash:", token_hash?.substring(0, 20));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = token_hash.startsWith("pkce_")
    ? await supabase.auth.exchangeCodeForSession(token_hash)
    : await supabase.auth.verifyOtp({ token_hash, type: type as any });

  console.log("[callback] error:", error);
  console.log("[callback] session:", !!data?.session);

  if (error || !data?.session) {
    console.error("[callback] auth failed:", error);
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", request.url)
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
