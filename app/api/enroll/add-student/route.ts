import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { firstName, lastName, dateOfBirth, medicalNotes } = body;

  if (!firstName || !dateOfBirth) {
    return NextResponse.json(
      { error: "Name and date of birth are required" },
      { status: 400 }
    );
  }

  // Calculate age group
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  let ageGroup: string;
  if (age <= 4) ageGroup = "toddler";
  else if (age <= 7) ageGroup = "primary";
  else if (age <= 11) ageGroup = "intermediate";
  else ageGroup = "advanced";

  const { data, error } = await supabase
    .from("students")
    .insert({
      parent_id: user.id,
      first_name: firstName,
      last_name: lastName || "",
      date_of_birth: dateOfBirth,
      age_group: ageGroup,
      medical_notes: medicalNotes || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[enroll:addStudent]", error);
    return NextResponse.json(
      { error: "Failed to add student" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, studentId: data.id });
}
