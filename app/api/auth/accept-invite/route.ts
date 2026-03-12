import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

// GET: Fetch invite details by token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: invite, error } = await supabase
    .from("staff_invites")
    .select("email, first_name, last_name, role, accepted_at, expires_at")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 400 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
  }

  return NextResponse.json({ invite: { email: invite.email, first_name: invite.first_name, role: invite.role } });
}

// POST: Accept invite and create account
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, password } = body;

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch invite
  const { data: invite, error: fetchError } = await supabase
    .from("staff_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (fetchError || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 400 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
  }

  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  // Determine redirect based on role
  const roleHome: Record<string, string> = {
    teacher: "/teach/dashboard",
    studio_admin: "/admin/dashboard",
    finance_admin: "/admin/dashboard",
    studio_manager: "/admin/dashboard",
    admin: "/admin/dashboard",
  };
  const redirectTo = roleHome[invite.role] ?? "/admin/dashboard";

  // Create auth user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: {
      emailRedirectTo: `${origin}/callback?redirect=${redirectTo}`,
      data: {
        first_name: invite.first_name,
        last_name: invite.last_name,
        role: invite.role,
      },
    },
  });

  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  // Update profile with name and active status
  if (signUpData.user) {
    await supabase
      .from("profiles")
      .update({
        first_name: invite.first_name,
        last_name: invite.last_name,
        approval_status: "active",
      })
      .eq("id", signUpData.user.id);
  }

  // Mark invite as accepted
  await supabase
    .from("staff_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({
    success: true,
    redirectTo: "/login",
  });
}
