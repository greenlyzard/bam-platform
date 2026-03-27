import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = '84d98f72-c82f-414f-8b17-172b802f6993';
const LOCATION_ID = '70acde19-bd54-46c2-a4f4-2200b0adb393';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Teacher name → profile UUID
const TEACHER_MAP = {
  'Ally Helmen': '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02',
  'Amanda Cobb': '6518a096-9b37-435a-8c0c-595063a2dcd9',
  'Campbell Castner': '0f5d3da0-7fbe-44c9-b056-0f6695a22534',
  'Cara Matchett': 'e406cbc5-8937-4a53-95e7-059097cd29c2',
  'Deborah Fauerbach': '0da9bb9e-10a2-4be4-aeab-de8421347827',
  'Katherine Thomas': '95bbed94-7050-46f2-a76a-1990876ad93f',
  'Kylie Yamano': 'eaadd657-cd9e-4436-919a-36d9ee587031',
  'Lauryn Rowe': 'fc7d6951-6f67-472a-8920-a4faace6642a',
  'Madelynn Hampton': '04263b03-5128-49e7-b058-857b62162fff',
  'Paola Gonzalez': '80181273-4970-4e3b-8d5e-fd579304dc89',
  'Samantha Weeks': '9033aa5d-6240-4c01-a3a6-bbb147cc84e6',
};

const DAY_MAP = {
  'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0,
};

// Room name → first room id
const ROOM_MAP = {
  'Studio 1': 'c2401222-2dee-46db-9bd6-ad2d213386ec',
  'Studio 2': '2d20e3ee-adfc-403a-b69b-bc452885590b',
  'Studio 3': '75792345-477e-45b8-8f74-4935a37b9769',
};

async function createTeacher(firstName, lastName, email) {
  console.log(`Creating auth user for ${firstName} ${lastName}...`);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: 'TempPass2026!',
    user_metadata: { first_name: firstName, last_name: lastName },
  });
  if (error) {
    console.error(`  Auth user creation failed: ${error.message}`);
    // Check if already exists
    const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (existing) { console.log(`  Found existing profile: ${existing.id}`); return existing.id; }
    throw error;
  }
  console.log(`  Created auth user: ${data.user.id}`);
  // Ensure profile exists
  await supabase.from('profiles').upsert({
    id: data.user.id, first_name: firstName, last_name: lastName, email,
  }, { onConflict: 'id' });
  // Add teacher role
  await supabase.from('profile_roles').insert({
    user_id: data.user.id, role: 'teacher', tenant_id: TENANT_ID, is_active: true,
  }).then(r => { if (r.error && r.error.code !== '23505') console.warn('  Role insert:', r.error.message); });
  return data.user.id;
}

function parseTime(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial time (fraction of 24h)
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }
  const s = String(val).trim();
  // Try HH:MM or H:MM AM/PM
  const match = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (match) {
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const ampm = match[4];
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }
  return null;
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function parseBool(val) {
  if (val === true || val === 1 || String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'yes') return true;
  return false;
}

function parseFee(val) {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return null;
  return Math.round(n * 100); // dollars to cents
}

async function main() {
  console.log('Reading Excel file...');
  const wb = XLSX.readFile('/Users/derekshaw/Downloads/BAM_Class_Import_Template.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Find header row (row with "name" or "class_name" in it)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    if (row && row.some(c => String(c).toLowerCase().includes('name'))) {
      headerIdx = i;
      break;
    }
  }
  console.log(`Header row index: ${headerIdx}`);
  console.log(`Headers: ${rows[headerIdx]?.slice(0, 10).join(', ')}`);
  console.log(`Total rows: ${rows.length}`);

  // Create new teachers
  console.log('\n--- Creating new teachers ---');
  const elizaId = await createTeacher('Eliza', 'Johnson', 'eliza.johnson@bamsocal.com');
  const kaitlanId = await createTeacher('Kaitlan', 'Mills', 'kaitlan.mills@bamsocal.com');
  TEACHER_MAP['Eliza Johnson'] = elizaId;
  TEACHER_MAP['Kaitlan Mills'] = kaitlanId;
  console.log(`Eliza: ${elizaId}`);
  console.log(`Kaitlan: ${kaitlanId}`);

  // Clear existing data
  console.log('\n--- Clearing existing classes ---');
  await supabase.from('class_teachers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('classes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared.');

  // Process data rows (skip header)
  const dataRows = rows.slice(headerIdx + 1).filter(r => r && r[1]); // column B = name
  console.log(`\n--- Importing ${dataRows.length} classes ---`);

  let imported = 0;
  let errors = 0;

  for (const row of dataRows) {
    const name = String(row[1] ?? '').trim();
    if (!name) continue;

    const dayName = String(row[2] ?? '').trim();
    const dayOfWeek = DAY_MAP[dayName] ?? null;
    const startTime = parseTime(row[3]);
    const endTime = parseTime(row[4]);
    const season = row[5] ? String(row[5]).trim() : null;
    const startDate = parseDate(row[6]);
    const endDate = parseDate(row[7]);
    const roomName = row[8] ? String(row[8]).trim() : null;
    const teacherName = row[9] ? String(row[9]).trim() : null;
    const maxStudents = row[10] ? parseInt(row[10]) : 10;
    const minStudents = row[11] ? parseInt(row[11]) : null;
    const levelRaw = row[12] ? String(row[12]).trim() : null;
    const level = levelRaw ? levelRaw.split(';')[0].trim() : null;
    const disciplineRaw = row[13] ? String(row[13]).trim() : null;
    const discipline = disciplineRaw ? disciplineRaw.split(';')[0].trim() : null;
    const classType = row[14] ? String(row[14]).trim() : 'regular';
    const program = row[15] ? String(row[15]).trim() : null;
    const trialEligible = parseBool(row[17]);
    const status = row[18] ? String(row[18]).trim() : 'active';
    const feeCents = parseFee(row[21]);
    const shortDesc = row[22] ? String(row[22]).trim() : null;
    const medDesc = row[23] ? String(row[23]).trim() : null;
    const longDesc = row[24] ? String(row[24]).trim() : null;
    const ageMin = row[25] ? parseInt(row[25]) : null;
    const ageMax = row[26] ? parseInt(row[26]) : null;

    const teacherId = teacherName ? TEACHER_MAP[teacherName] ?? null : null;
    const roomId = roomName ? ROOM_MAP[roomName] ?? null : null;

    const classRecord = {
      name,
      day_of_week: dayOfWeek,
      days_of_week: dayOfWeek != null ? [dayOfWeek] : null,
      start_time: startTime,
      end_time: endTime,
      season: season,
      start_date: startDate,
      end_date: endDate,
      room: roomName,
      room_id: roomId,
      location_id: LOCATION_ID,
      teacher_id: teacherId,
      max_students: maxStudents || 10,
      max_enrollment: maxStudents || 10,
      style: discipline,
      discipline: discipline,
      levels: level ? [level] : null,
      status: status || 'active',
      is_active: status !== 'inactive',
      trial_eligible: trialEligible,
      fee_cents: feeCents,
      short_description: shortDesc,
      medium_description: medDesc,
      long_description: longDesc || medDesc || shortDesc,
      description: shortDesc,
      age_min: isNaN(ageMin) ? null : ageMin,
      age_max: isNaN(ageMax) ? null : ageMax,
      online_registration: true,
      show_capacity_public: true,
      is_hidden: false,
      is_new: false,
      is_rehearsal: classType === 'rehearsal',
      is_performance: classType === 'performance',
      point_cost: 1,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('classes')
      .insert(classRecord)
      .select('id')
      .single();

    if (insertErr) {
      console.error(`  ERROR inserting "${name}": ${insertErr.message}`);
      errors++;
      continue;
    }

    // Insert class_teacher
    if (teacherId) {
      const { error: ctErr } = await supabase.from('class_teachers').insert({
        class_id: inserted.id,
        teacher_id: teacherId,
        role: 'lead',
        is_primary: true,
        tenant_id: TENANT_ID,
      });
      if (ctErr) console.warn(`  class_teachers warning for "${name}": ${ctErr.message}`);
    }

    imported++;
    if (imported % 10 === 0) console.log(`  ${imported} classes imported...`);
  }

  console.log(`\n--- DONE ---`);
  console.log(`Imported: ${imported}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total in DB: checking...`);

  const { count } = await supabase.from('classes').select('id', { count: 'exact', head: true });
  console.log(`Classes in DB: ${count}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
