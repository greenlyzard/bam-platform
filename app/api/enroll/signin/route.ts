import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }

  // Fetch existing students
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("parent_id", user.id)
    .eq("active", true)
    .order("first_name");

  return NextResponse.json({
    success: true,
    students: students ?? [],
  });
}
