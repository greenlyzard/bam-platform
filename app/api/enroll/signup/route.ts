import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, firstName, lastName, phone, referralSource } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/callback?redirect=/enroll`,
      data: {
        first_name: firstName,
        last_name: lastName,
        role: "parent",
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Update profile with phone and referral if provided
  if (data.user && (phone || referralSource)) {
    await supabase
      .from("profiles")
      .update({
        phone: phone || null,
        first_name: firstName || null,
        last_name: lastName || null,
      })
      .eq("id", data.user.id);
  }

  // Fetch any existing students (shouldn't have any for new signup)
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("parent_id", data.user?.id ?? "")
    .eq("active", true);

  return NextResponse.json({
    success: true,
    students: students ?? [],
  });
}
