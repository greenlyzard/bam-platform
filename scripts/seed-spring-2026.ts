/**
 * Seed script: 2026 Sylvia Ballet & Spring Showcase
 *
 * Populates:
 *   1. Production record
 *   2. Dances (one per role from casting schedule)
 *   3. Production–dance links
 *   4. Dummy parent profile + student records (62 students)
 *   5. Casting assignments (166 entries)
 *   6. Rehearsal entries in both tables:
 *      - `rehearsals` (old, linked to production_dances)   → for casting module
 *      - rehearsals table with tenant_id + cast_groups      → for embed/portal view
 *
 * Usage:
 *   npx tsx scripts/seed-spring-2026.ts
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   (or NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import data from "./spring-2026-data.json";

// Load .env.local manually (avoid dotenv dependency)
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
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing env: SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const PRODUCTION_NAME = "2026 Sylvia Ballet & Spring Showcase";
const SEASON = "2026 Spring";
const VENUE = "San Juan Hills High School";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeTime(t: string): string {
  // Handle "1900-01-04 18:30:00" → "18:30:00"
  if (t.includes(" ")) {
    t = t.split(" ").pop()!;
  }
  // Ensure HH:MM:SS
  const parts = t.split(":");
  if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
  return t;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding 2026 Spring production data...\n");

  // ── 0. Ensure tenant exists ─────────────────────────────────
  let tenantId: string;
  const { data: existingTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  if (existingTenant) {
    tenantId = existingTenant.id;
    console.log(`Using existing tenant: ${tenantId}`);
  } else {
    const { data: newTenant, error } = await supabase
      .from("tenants")
      .insert({ name: "Ballet Academy and Movement", slug: "bam" })
      .select("id")
      .single();
    if (error) throw error;
    tenantId = newTenant!.id;
    console.log(`Created tenant: ${tenantId}`);
  }

  // ── 1. Production ───────────────────────────────────────────
  const { data: existingProd } = await supabase
    .from("productions")
    .select("id")
    .eq("name", PRODUCTION_NAME)
    .single();

  let productionId: string;
  if (existingProd) {
    productionId = existingProd.id;
    console.log(`Production already exists: ${productionId}`);
  } else {
    const { data: prod, error } = await supabase
      .from("productions")
      .insert({
        name: PRODUCTION_NAME,
        production_type: "recital",
        season: SEASON,
        venue_name: VENUE,
        venue_address: "San Juan Hills High School, San Juan Capistrano, CA",
        performance_date: "2026-06-06",
        start_time: "14:00:00",
        end_time: "17:00:00",
        approval_status: "approved",
        is_published: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    productionId = prod!.id;
    console.log(`Created production: ${productionId}`);
  }

  // ── 2. Dances (one per role) ────────────────────────────────
  const roleMap: Record<string, string> = {}; // role_name → dance_id
  for (const role of data.roles) {
    const { data: existing } = await supabase
      .from("dances")
      .select("id")
      .eq("title", role.name)
      .single();

    if (existing) {
      roleMap[role.name] = existing.id;
    } else {
      const { data: dance, error } = await supabase
        .from("dances")
        .insert({
          title: role.name,
          discipline: "ballet",
          level: role.level,
          notes: role.is_understudy ? "Understudy role" : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      roleMap[role.name] = dance!.id;
    }
  }
  console.log(`Dances: ${Object.keys(roleMap).length} roles mapped`);

  // ── 3. Production–Dance links ──────────────────────────────
  const pdMap: Record<string, string> = {}; // role_name → production_dance_id
  for (const role of data.roles) {
    const danceId = roleMap[role.name];
    const { data: existing } = await supabase
      .from("production_dances")
      .select("id")
      .eq("production_id", productionId)
      .eq("dance_id", danceId)
      .single();

    if (existing) {
      pdMap[role.name] = existing.id;
    } else {
      const { data: pd, error } = await supabase
        .from("production_dances")
        .insert({
          production_id: productionId,
          dance_id: danceId,
          performance_type: "recital",
          performance_order: role.order,
        })
        .select("id")
        .single();
      if (error) throw error;
      pdMap[role.name] = pd!.id;
    }
  }
  console.log(`Production-dances: ${Object.keys(pdMap).length} linked`);

  // ── 4. Students ─────────────────────────────────────────────
  // Create a dummy parent profile for seed students
  let parentId: string;
  const SEED_PARENT_EMAIL = "seed-parent@bamsocal.com";
  const { data: existingParent } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", SEED_PARENT_EMAIL)
    .single();

  if (existingParent) {
    parentId = existingParent.id;
  } else {
    const { data: parent, error } = await supabase
      .from("profiles")
      .insert({
        id: crypto.randomUUID(),
        first_name: "Seed",
        last_name: "Parent",
        email: SEED_PARENT_EMAIL,
        role: "parent",
      })
      .select("id")
      .single();
    if (error) throw error;
    parentId = parent!.id;
  }

  const studentMap: Record<string, string> = {}; // "First Last" → student_id
  for (const student of data.students) {
    const fullName = `${student.first_name} ${student.last_name}`;
    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("first_name", student.first_name)
      .eq("last_name", student.last_name)
      .single();

    if (existing) {
      studentMap[fullName] = existing.id;
    } else {
      const { data: s, error } = await supabase
        .from("students")
        .insert({
          parent_id: parentId,
          first_name: student.first_name,
          last_name: student.last_name,
          date_of_birth: "2015-01-01", // placeholder
          active: true,
        })
        .select("id")
        .single();
      if (error) {
        console.error(`Error creating student ${fullName}:`, error.message);
        continue;
      }
      studentMap[fullName] = s!.id;
    }
  }
  console.log(`Students: ${Object.keys(studentMap).length} created/found`);

  // ── 5. Casting ──────────────────────────────────────────────
  let castingCount = 0;
  for (const c of data.casting) {
    const fullName = `${c.first_name} ${c.last_name}`;
    const studentId = studentMap[fullName];
    const pdId = pdMap[c.role_name];
    if (!studentId || !pdId) continue;

    const { data: existing } = await supabase
      .from("casting")
      .select("id")
      .eq("production_dance_id", pdId)
      .eq("student_id", studentId)
      .single();

    if (!existing) {
      const { error } = await supabase.from("casting").insert({
        production_dance_id: pdId,
        student_id: studentId,
        role: "ensemble",
        is_alternate: c.is_understudy,
      });
      if (error) {
        console.error(`Casting error (${fullName} → ${c.role_name}):`, error.message);
        continue;
      }
      castingCount++;
    }
  }
  console.log(`Casting: ${castingCount} new assignments created`);

  // ── 6. Rehearsals (new table with cast_groups for embed/portal) ──
  // Group schedule entries by date+time+location to create consolidated rehearsals
  const rehearsalGroups: Record<
    string,
    { date: string; start: string; end: string; location: string; teacher: string; roles: Set<string> }
  > = {};

  for (const entry of data.schedule) {
    const start = normalizeTime(entry.start);
    const end = normalizeTime(entry.end);
    const key = `${entry.date}|${start}|${end}|${entry.location}`;

    if (!rehearsalGroups[key]) {
      rehearsalGroups[key] = {
        date: entry.date,
        start,
        end,
        location: entry.location || "BAM Studios",
        teacher: entry.teacher,
        roles: new Set(),
      };
    }
    rehearsalGroups[key].roles.add(entry.role);
    // Keep the more specific teacher
    if (entry.teacher && !rehearsalGroups[key].teacher) {
      rehearsalGroups[key].teacher = entry.teacher;
    }
  }

  let rehearsalCount = 0;
  for (const group of Object.values(rehearsalGroups)) {
    const castGroups = Array.from(group.roles);
    const title = castGroups.length === 1 ? castGroups[0] : `${castGroups[0]} + ${castGroups.length - 1} more`;

    // Check for existing rehearsal on same date/time
    const { data: existing } = await supabase
      .from("rehearsals")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("production_id", productionId)
      .eq("date", group.date)
      .eq("start_time", group.start)
      .eq("end_time", group.end)
      .single();

    if (!existing) {
      const { error } = await supabase.from("rehearsals").insert({
        tenant_id: tenantId,
        production_id: productionId,
        title,
        date: group.date,
        start_time: group.start,
        end_time: group.end,
        location: group.location,
        cast_groups: castGroups,
        notes: group.teacher ? `Teacher: ${group.teacher}` : null,
      });
      if (error) {
        console.error(`Rehearsal error (${group.date} ${group.start}):`, error.message);
        continue;
      }
      rehearsalCount++;
    }
  }
  console.log(`Rehearsals (embed/portal): ${rehearsalCount} created`);

  // ── 7. Rehearsals (old casting-linked table) ────────────────
  // Create individual rehearsal entries linked to production_dances
  let oldRehearsalCount = 0;
  for (const entry of data.schedule) {
    const pdId = pdMap[entry.role];
    if (!pdId) continue;

    const start = normalizeTime(entry.start);
    const end = normalizeTime(entry.end);

    // Use the old rehearsals table (production_dance_id based)
    // Check if we need to check for conflicts with the new table name
    // The old table was dropped and recreated in migration 20260313000004
    // which uses tenant_id instead of production_dance_id.
    // So we only insert into the new rehearsals table above.
    // Skip old-table inserts since the schema was replaced.
  }

  console.log("\nSeed complete!");
  console.log(`  Production: ${PRODUCTION_NAME}`);
  console.log(`  Roles: ${data.roles.length}`);
  console.log(`  Students: ${Object.keys(studentMap).length}`);
  console.log(`  Casting: ${castingCount}`);
  console.log(`  Rehearsals: ${rehearsalCount}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
