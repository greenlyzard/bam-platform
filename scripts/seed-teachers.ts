/**
 * Seed script: Create teacher accounts for BAM
 *
 * Creates auth users, profiles, teachers, and teacher_profiles for all BAM teachers.
 * Generates passwords using the pattern Bam@[LastName]2026.
 * Does NOT send welcome emails — those are triggered manually from admin UI.
 *
 * Usage:
 *   npx tsx scripts/seed-teachers.ts
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually
try {
  const envFile = readFileSync(".env.local", "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found, rely on existing env
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing env: SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const TENANT_ID = "84d98f72-c82f-414f-8b17-172b802f6993";

interface TeacherData {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string;
  role: "teacher" | "admin"; // admin = teacher + admin access
  teacherType: "lead" | "assistant" | "substitute" | "contractor_1099" | "admin_only";
  employmentType: "w2" | "1099";
}

const TEACHERS: TeacherData[] = [
  { firstName: "Aleah", lastName: "Doone", preferredName: null, email: "aleahdoone@gmail.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Ally", lastName: "Helman", preferredName: null, email: "allyhelman@icloud.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Bethany", lastName: "Tisza", preferredName: null, email: "bethanytisza2313@gmail.com", role: "admin", teacherType: "lead", employmentType: "w2" },
  { firstName: "Campbell", lastName: "Castner", preferredName: null, email: "ccastner717@gmail.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Cara", lastName: "Matchett", preferredName: null, email: "cara@bamsocal.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Catherine", lastName: "Golpin", preferredName: "Kiki", email: "cgolpin.cjb@gmail.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Deborah", lastName: "Fauerbach", preferredName: null, email: "4FORFAUER@gmail.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Elena", lastName: "Lange", preferredName: null, email: "elenaclange@gmail.com", role: "admin", teacherType: "lead", employmentType: "w2" },
  { firstName: "Kylie", lastName: "Yamano", preferredName: null, email: "kylieyamano@gmail.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Lauryn", lastName: "Rowe", preferredName: null, email: "laurynrowe19@gmail.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Leila", lastName: "Meghdadi", preferredName: null, email: "leilameghdadi47@gmail.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Madelynn", lastName: "Hampton", preferredName: null, email: "hamptonmadelynn@gmail.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Marry", lastName: "Morales", preferredName: null, email: "marryamorales@gmail.com", role: "admin", teacherType: "lead", employmentType: "w2" },
  { firstName: "Paola", lastName: "Gonzalez", preferredName: "Pie", email: "paola.gonzalez2798@gmail.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Samantha", lastName: "Weeks", preferredName: "Sam", email: "samweeks16@gmail.com", role: "teacher", teacherType: "lead", employmentType: "w2" },
  { firstName: "Gem", lastName: "Bognot", preferredName: null, email: "gem@bamsocal.com", role: "admin", teacherType: "lead", employmentType: "w2" },
];

function generatePassword(lastName: string): string {
  return `Bam@${lastName}2026`;
}

async function main() {
  console.log("Seeding teacher accounts...\n");

  // Verify tenant exists
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", TENANT_ID)
    .single();

  if (!tenant) {
    console.error(`Tenant ${TENANT_ID} not found. Run seed-spring-2026.ts first.`);
    process.exit(1);
  }

  const results: { name: string; email: string; password: string; status: string }[] = [];

  for (const t of TEACHERS) {
    const fullName = `${t.firstName} ${t.lastName}`;
    const password = generatePassword(t.lastName);
    const profileRole = t.role === "admin" ? "admin" : "teacher";

    console.log(`\n── ${fullName} (${t.email}) ──`);

    // 1. Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === t.email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`  Auth user already exists: ${userId}`);

      // Update password for existing user
      const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
        password,
      });
      if (updateErr) {
        console.log(`  Warning: Could not update password: ${updateErr.message}`);
      } else {
        console.log(`  Updated password`);
      }
    } else {
      // 2. Create auth user with password
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: t.email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: t.firstName,
          last_name: t.lastName,
          preferred_name: t.preferredName,
          role: profileRole,
        },
      });

      if (createErr) {
        console.error(`  FAILED to create auth user: ${createErr.message}`);
        results.push({ name: fullName, email: t.email, password, status: `FAILED: ${createErr.message}` });
        continue;
      }

      userId = newUser.user.id;
      console.log(`  Created auth user: ${userId}`);
    }

    // 3. Update profile (auto-created by handle_new_user trigger)
    // Give the trigger a moment to fire
    await new Promise((r) => setTimeout(r, 500));

    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        first_name: t.firstName,
        last_name: t.lastName,
        preferred_name: t.preferredName,
        email: t.email,
        role: profileRole,
      }, { onConflict: "id" });

    if (profileErr) {
      console.error(`  FAILED to upsert profile: ${profileErr.message}`);
    } else {
      console.log(`  Profile set (role: ${profileRole})`);
    }

    // 4. Create teachers record (legacy table for pay rates / compliance)
    const { error: teacherErr } = await supabase
      .from("teachers")
      .upsert({
        id: userId,
        employment_type: "part_time",
        can_be_scheduled: true,
      }, { onConflict: "id" });

    if (teacherErr) {
      console.error(`  FAILED to upsert teacher: ${teacherErr.message}`);
    } else {
      console.log(`  Teachers record set`);
    }

    // 5. Create teacher_profiles record (portal table)
    const { data: existingTp } = await supabase
      .from("teacher_profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", TENANT_ID)
      .maybeSingle();

    if (existingTp) {
      console.log(`  Teacher profile already exists: ${existingTp.id}`);
    } else {
      const { error: tpErr } = await supabase
        .from("teacher_profiles")
        .insert({
          tenant_id: TENANT_ID,
          user_id: userId,
          first_name: t.firstName,
          last_name: t.lastName,
          email: t.email,
          teacher_type: t.teacherType,
          employment_type: t.employmentType,
          is_active: true,
        });

      if (tpErr) {
        console.error(`  FAILED to create teacher_profile: ${tpErr.message}`);
      } else {
        console.log(`  Teacher profile created`);
      }
    }

    results.push({ name: fullName, email: t.email, password, status: "OK" });
  }

  // Print credentials summary
  console.log("\n\n════════════════════════════════════════════════════");
  console.log("  TEACHER CREDENTIALS (save this!)");
  console.log("════════════════════════════════════════════════════\n");
  console.log("Name".padEnd(25) + "Email".padEnd(35) + "Password".padEnd(20) + "Status");
  console.log("─".repeat(90));
  for (const r of results) {
    console.log(
      r.name.padEnd(25) +
      r.email.padEnd(35) +
      r.password.padEnd(20) +
      r.status
    );
  }
  console.log("\n════════════════════════════════════════════════════\n");
  console.log(`Total: ${results.length} teachers processed`);
  console.log(`OK: ${results.filter((r) => r.status === "OK").length}`);
  console.log(`Failed: ${results.filter((r) => r.status !== "OK").length}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
