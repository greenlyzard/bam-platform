import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = request.nextUrl.searchParams.get("next") ?? "/admin/dashboard";

  console.log("[callback] hit GET handler");
  console.log("[callback] url:", request.url);
  console.log("[callback] token_hash:", token_hash?.substring(0, 20));
  console.log("[callback] type:", type);

  if (!token_hash || !type) {
    console.error("[callback] missing params, redirecting to login");
    return NextResponse.redirect(
      new URL("/login?error=missing_params", request.url)
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("[callback] supabase url:", supabaseUrl?.substring(0, 30));
  console.log("[callback] supabase key exists:", !!supabaseKey);

  if (!supabaseUrl || !supabaseKey) {
    console.error("[callback] missing supabase env vars");
    return NextResponse.redirect(
      new URL("/login?error=server_config", request.url)
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let data: any;
  let error: any;

  if (token_hash.startsWith("pkce_")) {
    console.log("[callback] using exchangeCodeForSession for pkce_ token");
    const result = await supabase.auth.exchangeCodeForSession(token_hash);
    data = result.data;
    error = result.error;
  } else {
    console.log("[callback] using verifyOtp");
    const result = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });
    data = result.data;
    error = result.error;
  }

  console.log("[callback] error:", error?.message ?? "none");
  console.log("[callback] session:", !!data?.session);

  if (error || !data?.session) {
    console.error("[callback] auth failed:", error);
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", request.url)
    );
  }

  console.log("[callback] success, redirecting to:", next);
  return NextResponse.redirect(new URL(next, request.url));
}
