"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuestionDef = {
  slug: string;
  label: string;
  question_type: string;
  category: string;
};

type SectionDef = {
  name: string;
  slug: string;
  sort_order: number;
  questions: string[]; // slugs referencing the question bank
};

type TemplateDef = {
  name: string;
  slug: string;
  level_tag: string;
  description: string;
  sort_order: number;
  sections: SectionDef[];
};

// ---------------------------------------------------------------------------
// Question Bank — all unique questions across all 3 templates
// ---------------------------------------------------------------------------

const ALL_QUESTIONS: QuestionDef[] = [
  // Floor Warmup
  { slug: "warmup_sitting_tall", label: "Sitting Tall / Posture", question_type: "nse_rating", category: "Floor Warmup" },
  { slug: "warmup_straight_leg", label: "Straight Leg Stretches", question_type: "nse_rating", category: "Floor Warmup" },
  { slug: "warmup_butterfly", label: "Butterfly", question_type: "nse_rating", category: "Floor Warmup" },
  { slug: "warmup_pointe_flex", label: "Pointe & Flex", question_type: "nse_rating", category: "Floor Warmup" },
  { slug: "warmup_turnout", label: "Turnout", question_type: "nse_rating", category: "Floor Warmup" },
  { slug: "warmup_mermaid", label: "Mermaid Stretch", question_type: "nse_rating", category: "Floor Warmup" },

  // Class Etiquette
  { slug: "etiquette_enter_standing", label: "Enters Barre Standing Nicely", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_enter_eye_contact", label: "Enters Barre with Poise & Eye Contact", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_curtsy", label: "Curtsy / Reverence", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_walk_to_spots", label: "Walks to Spots Nicely", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_listening", label: "Listening Skills", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_effort", label: "Effort & Participation", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_musicality", label: "Musicality", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_maturity", label: "Maturity", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_respect", label: "Respect for Teachers & Peers", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_dress_code", label: "Proper Dress Code", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_self_discipline", label: "Self-Discipline", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_work_ethic", label: "Work Ethic", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_commitment", label: "Commitment", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_confidence", label: "Confidence", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_attitude_respect", label: "Attitude & Respect", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_poise_focus", label: "Poise & Focus", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_starting_finishing", label: "Starting & Finishing Movements", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_spatial_awareness", label: "Spatial Awareness", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_execution", label: "Execution & Technique", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_vocabulary", label: "Vocabulary Knowledge", question_type: "nse_rating", category: "Class Etiquette" },
  { slug: "etiquette_musicality_rhythm", label: "Musicality & Rhythm", question_type: "nse_rating", category: "Class Etiquette" },

  // Center
  { slug: "center_feet_positions", label: "Feet Positions (1st\u20135th)", question_type: "nse_rating", category: "Center" },
  { slug: "center_ballerina_walks", label: "Ballerina Walks", question_type: "nse_rating", category: "Center" },
  { slug: "center_marching", label: "Marching", question_type: "nse_rating", category: "Center" },
  { slug: "center_skips", label: "Skips", question_type: "nse_rating", category: "Center" },
  { slug: "center_chases", label: "Chass\u00e9s", question_type: "nse_rating", category: "Center" },
  { slug: "center_soute_parallel", label: "Saut\u00e9 in Parallel", question_type: "nse_rating", category: "Center" },
  { slug: "center_bunny_hops", label: "Bunny Hops", question_type: "nse_rating", category: "Center" },
  { slug: "center_run_leap", label: "Run & Leap", question_type: "nse_rating", category: "Center" },
  { slug: "center_port_de_bras_basic", label: "Port de Bras (Basic)", question_type: "nse_rating", category: "Center" },
  { slug: "center_foot_progressions", label: "Foot Progressions", question_type: "nse_rating", category: "Center" },
  { slug: "center_releves", label: "Relev\u00e9s", question_type: "nse_rating", category: "Center" },
  { slug: "center_tendus", label: "Tendus", question_type: "nse_rating", category: "Center" },
  { slug: "center_chaines", label: "Cha\u00een\u00e9s", question_type: "nse_rating", category: "Center" },
  { slug: "center_cecchetti_port_de_bras", label: "Cecchetti Port de Bras", question_type: "nse_rating", category: "Center" },
  { slug: "center_body_dir_croise", label: "Body Direction: Crois\u00e9", question_type: "nse_rating", category: "Center" },
  { slug: "center_body_dir_efface", label: "Body Direction: Effac\u00e9", question_type: "nse_rating", category: "Center" },
  { slug: "center_body_dir_ecarte", label: "Body Direction: \u00c9cart\u00e9", question_type: "nse_rating", category: "Center" },
  { slug: "center_body_dir_en_face", label: "Body Direction: En Face", question_type: "nse_rating", category: "Center" },
  { slug: "center_tendu_transfer", label: "Tendu with Weight Transfer", question_type: "nse_rating", category: "Center" },
  { slug: "center_adagio_advanced", label: "Adagio (Advanced)", question_type: "nse_rating", category: "Center" },
  { slug: "center_pirouette_en_dehors", label: "Pirouette en Dehors", question_type: "nse_rating", category: "Center" },
  { slug: "center_pirouette_en_dedans", label: "Pirouette en Dedans", question_type: "nse_rating", category: "Center" },
  { slug: "center_turns_piques", label: "Piqu\u00e9 Turns", question_type: "nse_rating", category: "Center" },
  { slug: "center_turns_chaines", label: "Cha\u00een\u00e9 Turns", question_type: "nse_rating", category: "Center" },
  { slug: "center_turns_step_up", label: "Step-Up Turns", question_type: "nse_rating", category: "Center" },
  { slug: "center_waltz_balances", label: "Waltz Balanc\u00e9s", question_type: "nse_rating", category: "Center" },
  { slug: "center_small_jumps", label: "Small Jumps (Changements, Echapp\u00e9s)", question_type: "nse_rating", category: "Center" },
  { slug: "center_petite_allegro_beats", label: "Petite Allegro with Beats", question_type: "nse_rating", category: "Center" },
  { slug: "center_beats_royale", label: "Beats Royale", question_type: "nse_rating", category: "Center" },

  // Barre
  { slug: "barre_plie", label: "Pli\u00e9", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_tendu_degage", label: "Tendu / D\u00e9gag\u00e9", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_rond_de_jambe", label: "Rond de Jambe", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_fondu", label: "Fondu", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_sur_la_cou", label: "Sur le Cou-de-Pied", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_frappe", label: "Frapp\u00e9", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_retire", label: "Retir\u00e9 / Pass\u00e9", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_arabesque", label: "Arabesque", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_adagio", label: "Adagio at Barre", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_grand_battement", label: "Grand Battement", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_posture", label: "Posture & Alignment", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_turnout", label: "Turnout at Barre", question_type: "nse_rating", category: "Barre" },
  { slug: "barre_releves_ankle", label: "Relev\u00e9s & Ankle Strength", question_type: "nse_rating", category: "Barre" },

  // Skills
  { slug: "skills_splits_r", label: "Right Splits", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_splits_l", label: "Left Splits", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_over_splits", label: "Over-Splits", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_middle_splits", label: "Middle Splits", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_leg_hold_r", label: "Right Leg Hold", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_leg_hold_l", label: "Left Leg Hold", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_ponche_r", label: "Right Pench\u00e9", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_ponche_l", label: "Left Pench\u00e9", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_back_bend", label: "Back Bend", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_scorpion_r", label: "Right Scorpion", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_scorpion_l", label: "Left Scorpion", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_hollow_hold", label: "Hollow Hold", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_plank", label: "Plank", question_type: "nse_rating", category: "Skills" },
  { slug: "skills_pushups", label: "Push-Ups", question_type: "nse_rating", category: "Skills" },

  // Jazz / Contemporary
  { slug: "jazz_battements_advanced", label: "Advanced Battements", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_leg_holds_turns", label: "Leg Holds with Turns", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_pirouette_l_triple", label: "Left Triple Pirouette", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_pirouette_r_quad", label: "Right Quad Pirouette", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_a_la_seconde_1x8", label: "\u00c0 la Seconde Turns (1x8)", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_right_penche", label: "Right Pench\u00e9 (Jazz)", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_left_penche", label: "Left Pench\u00e9 (Jazz)", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_right_leaps", label: "Right Leaps", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_left_leaps", label: "Left Leaps", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_right_center_leap", label: "Right Center Leap", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_left_center_leap", label: "Left Center Leap", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_calypso_r", label: "Right Calypso", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_calypso_l", label: "Left Calypso", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "jazz_walks_4b", label: "Jazz Walks (4B)", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "contemp_floorwork", label: "Contemporary Floorwork", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "contemp_combo_retention", label: "Combination Retention", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "contemp_musicality", label: "Contemporary Musicality", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "contemp_dynamics", label: "Dynamics & Quality", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "contemp_performance", label: "Performance Quality", question_type: "nse_rating", category: "Jazz / Contemporary" },
  { slug: "contemp_improvisation", label: "Improvisation", question_type: "nse_rating", category: "Jazz / Contemporary" },

  // Comments / Placement
  { slug: "comments_instructor", label: "Instructor Comments", question_type: "free_text", category: "Comments / Placement" },
  { slug: "comments_mid", label: "Additional Comments", question_type: "free_text", category: "Comments / Placement" },
  { slug: "comments_final", label: "Final Comments", question_type: "free_text", category: "Comments / Placement" },
  { slug: "placement_next_season", label: "Placement Recommendation", question_type: "level_placement", category: "Comments / Placement" },
  { slug: "entering_grade", label: "Entering Grade", question_type: "text_input", category: "Comments / Placement" },
];

// ---------------------------------------------------------------------------
// Template Definitions — 3 default templates
// ---------------------------------------------------------------------------

const TEMPLATE_DEFS: TemplateDef[] = [
  // ── Template 1: Petites & Level 1 (Beginner) ──────────────────────────
  {
    name: "Petites & Level 1 Evaluation",
    slug: "petites-level-1",
    level_tag: "Petites / Level 1",
    description: "Evaluation for Petites (ages 3–5) and Level 1 (ages 5–7). Focuses on floor warmup basics, etiquette, and introductory center work.",
    sort_order: 1,
    sections: [
      {
        name: "Floor Warmup",
        slug: "floor-warmup",
        sort_order: 1,
        questions: [
          "warmup_sitting_tall",
          "warmup_straight_leg",
          "warmup_butterfly",
          "warmup_pointe_flex",
          "warmup_turnout",
          "warmup_mermaid",
        ],
      },
      {
        name: "Class Etiquette",
        slug: "class-etiquette",
        sort_order: 2,
        questions: [
          "etiquette_enter_standing",
          "etiquette_curtsy",
          "etiquette_walk_to_spots",
          "etiquette_listening",
          "etiquette_effort",
          "etiquette_musicality",
          "etiquette_dress_code",
          "etiquette_confidence",
        ],
      },
      {
        name: "Center",
        slug: "center",
        sort_order: 3,
        questions: [
          "center_feet_positions",
          "center_ballerina_walks",
          "center_marching",
          "center_skips",
          "center_chases",
          "center_soute_parallel",
          "center_bunny_hops",
          "center_run_leap",
          "center_port_de_bras_basic",
        ],
      },
      {
        name: "Comments & Placement",
        slug: "comments-placement",
        sort_order: 4,
        questions: [
          "entering_grade",
          "comments_instructor",
          "placement_next_season",
        ],
      },
    ],
  },

  // ── Template 2: Level 2 (Intermediate) ────────────────────────────────
  {
    name: "Level 2 Evaluation",
    slug: "level-2-intermediate",
    level_tag: "Level 2",
    description: "Evaluation for Level 2 students (ages 7–10). Includes barre fundamentals, intermediate center, etiquette, and flexibility skills.",
    sort_order: 2,
    sections: [
      {
        name: "Class Etiquette & Professionalism",
        slug: "class-etiquette",
        sort_order: 1,
        questions: [
          "etiquette_enter_standing",
          "etiquette_enter_eye_contact",
          "etiquette_curtsy",
          "etiquette_walk_to_spots",
          "etiquette_listening",
          "etiquette_effort",
          "etiquette_musicality",
          "etiquette_maturity",
          "etiquette_respect",
          "etiquette_dress_code",
          "etiquette_self_discipline",
          "etiquette_work_ethic",
          "etiquette_confidence",
        ],
      },
      {
        name: "Barre",
        slug: "barre",
        sort_order: 2,
        questions: [
          "barre_plie",
          "barre_tendu_degage",
          "barre_rond_de_jambe",
          "barre_fondu",
          "barre_frappe",
          "barre_retire",
          "barre_arabesque",
          "barre_grand_battement",
          "barre_posture",
          "barre_turnout",
          "barre_releves_ankle",
        ],
      },
      {
        name: "Center",
        slug: "center",
        sort_order: 3,
        questions: [
          "center_feet_positions",
          "center_chases",
          "center_soute_parallel",
          "center_run_leap",
          "center_port_de_bras_basic",
          "center_foot_progressions",
          "center_releves",
          "center_tendus",
          "center_chaines",
        ],
      },
      {
        name: "Skills & Flexibility",
        slug: "skills",
        sort_order: 4,
        questions: [
          "skills_splits_r",
          "skills_splits_l",
          "skills_middle_splits",
          "skills_leg_hold_r",
          "skills_leg_hold_l",
          "skills_back_bend",
          "skills_hollow_hold",
          "skills_plank",
        ],
      },
      {
        name: "Comments & Placement",
        slug: "comments-placement",
        sort_order: 5,
        questions: [
          "entering_grade",
          "comments_instructor",
          "comments_mid",
          "placement_next_season",
        ],
      },
    ],
  },

  // ── Template 3: Level 3–4 (Advanced) ──────────────────────────────────
  {
    name: "Level 3–4 Advanced Evaluation",
    slug: "level-3-4-advanced",
    level_tag: "Level 3 / Level 4",
    description: "Comprehensive evaluation for Level 3–4 students. Full barre, advanced center, jazz/contemporary, complete skills assessment, and detailed comments.",
    sort_order: 3,
    sections: [
      {
        name: "Class Etiquette & Professionalism",
        slug: "class-etiquette",
        sort_order: 1,
        questions: [
          "etiquette_enter_eye_contact",
          "etiquette_curtsy",
          "etiquette_listening",
          "etiquette_effort",
          "etiquette_maturity",
          "etiquette_respect",
          "etiquette_dress_code",
          "etiquette_self_discipline",
          "etiquette_work_ethic",
          "etiquette_commitment",
          "etiquette_confidence",
          "etiquette_attitude_respect",
          "etiquette_poise_focus",
          "etiquette_starting_finishing",
          "etiquette_spatial_awareness",
          "etiquette_execution",
          "etiquette_vocabulary",
          "etiquette_musicality_rhythm",
        ],
      },
      {
        name: "Barre",
        slug: "barre",
        sort_order: 2,
        questions: [
          "barre_plie",
          "barre_tendu_degage",
          "barre_rond_de_jambe",
          "barre_fondu",
          "barre_sur_la_cou",
          "barre_frappe",
          "barre_retire",
          "barre_arabesque",
          "barre_adagio",
          "barre_grand_battement",
          "barre_posture",
          "barre_turnout",
          "barre_releves_ankle",
        ],
      },
      {
        name: "Center",
        slug: "center",
        sort_order: 3,
        questions: [
          "center_cecchetti_port_de_bras",
          "center_body_dir_croise",
          "center_body_dir_efface",
          "center_body_dir_ecarte",
          "center_body_dir_en_face",
          "center_tendu_transfer",
          "center_adagio_advanced",
          "center_pirouette_en_dehors",
          "center_pirouette_en_dedans",
          "center_turns_piques",
          "center_turns_chaines",
          "center_turns_step_up",
          "center_waltz_balances",
          "center_small_jumps",
          "center_petite_allegro_beats",
          "center_beats_royale",
        ],
      },
      {
        name: "Skills & Flexibility",
        slug: "skills",
        sort_order: 4,
        questions: [
          "skills_splits_r",
          "skills_splits_l",
          "skills_over_splits",
          "skills_middle_splits",
          "skills_leg_hold_r",
          "skills_leg_hold_l",
          "skills_ponche_r",
          "skills_ponche_l",
          "skills_back_bend",
          "skills_scorpion_r",
          "skills_scorpion_l",
          "skills_hollow_hold",
          "skills_plank",
          "skills_pushups",
        ],
      },
      {
        name: "Jazz / Contemporary",
        slug: "jazz-contemporary",
        sort_order: 5,
        questions: [
          "jazz_battements_advanced",
          "jazz_leg_holds_turns",
          "jazz_pirouette_l_triple",
          "jazz_pirouette_r_quad",
          "jazz_a_la_seconde_1x8",
          "jazz_right_penche",
          "jazz_left_penche",
          "jazz_right_leaps",
          "jazz_left_leaps",
          "jazz_right_center_leap",
          "jazz_left_center_leap",
          "jazz_calypso_r",
          "jazz_calypso_l",
          "jazz_walks_4b",
          "contemp_floorwork",
          "contemp_combo_retention",
          "contemp_musicality",
          "contemp_dynamics",
          "contemp_performance",
          "contemp_improvisation",
        ],
      },
      {
        name: "Comments & Placement",
        slug: "comments-placement",
        sort_order: 6,
        questions: [
          "entering_grade",
          "comments_instructor",
          "comments_mid",
          "comments_final",
          "placement_next_season",
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// SEED ACTION: seedDefaultTemplates
// ---------------------------------------------------------------------------

export async function seedDefaultTemplates(formData: FormData) {
  const supabase = await createClient();
  const tenantId = formData.get("tenant_id") as string;

  if (!tenantId) {
    return { error: "tenant_id is required" };
  }

  // Check if templates already exist for this tenant
  const { data: existing } = await supabase
    .from("evaluation_templates")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1);

  if (existing && existing.length > 0) {
    return { message: "Templates already exist for this tenant. Skipping seed." };
  }

  // ── Step 1: Seed the question bank ──────────────────────────────────
  const questionRows = ALL_QUESTIONS.map((q, idx) => ({
    tenant_id: tenantId,
    slug: q.slug,
    label: q.label,
    question_type: q.question_type,
    category: q.category,
    is_global: true,
    sort_order: idx,
  }));

  const { error: qError } = await supabase
    .from("evaluation_question_bank")
    .upsert(questionRows, { onConflict: "tenant_id,slug", ignoreDuplicates: true });

  if (qError) {
    return { error: `Failed to seed question bank: ${qError.message}` };
  }

  // Fetch all question IDs for this tenant keyed by slug
  const { data: allQuestions, error: fetchQError } = await supabase
    .from("evaluation_question_bank")
    .select("id, slug")
    .eq("tenant_id", tenantId);

  if (fetchQError || !allQuestions) {
    return { error: `Failed to fetch question bank: ${fetchQError?.message}` };
  }

  const slugToId: Record<string, string> = {};
  for (const q of allQuestions) {
    slugToId[q.slug] = q.id;
  }

  // ── Step 2: Create templates, sections, and link questions ──────────
  for (const tpl of TEMPLATE_DEFS) {
    // Insert template
    const { data: templateRow, error: tplError } = await supabase
      .from("evaluation_templates")
      .insert({
        tenant_id: tenantId,
        name: tpl.name,
        slug: tpl.slug,
        level_tag: tpl.level_tag,
        description: tpl.description,
        is_active: true,
        sort_order: tpl.sort_order,
      })
      .select("id")
      .single();

    if (tplError || !templateRow) {
      return { error: `Failed to create template "${tpl.name}": ${tplError?.message}` };
    }

    const templateId = templateRow.id;

    // Insert sections for this template
    for (const sec of tpl.sections) {
      const { data: sectionRow, error: secError } = await supabase
        .from("evaluation_template_sections")
        .insert({
          template_id: templateId,
          name: sec.name,
          slug: sec.slug,
          sort_order: sec.sort_order,
        })
        .select("id")
        .single();

      if (secError || !sectionRow) {
        return { error: `Failed to create section "${sec.name}": ${secError?.message}` };
      }

      const sectionId = sectionRow.id;

      // Link questions to this section
      const questionLinks = sec.questions.map((qSlug, idx) => {
        const questionId = slugToId[qSlug];
        if (!questionId) {
          throw new Error(`Question slug "${qSlug}" not found in question bank`);
        }
        return {
          section_id: sectionId,
          question_id: questionId,
          sort_order: idx,
          is_required: true,
        };
      });

      const { error: linkError } = await supabase
        .from("evaluation_template_questions")
        .insert(questionLinks);

      if (linkError) {
        return { error: `Failed to link questions to section "${sec.name}": ${linkError.message}` };
      }
    }
  }

  revalidatePath("/admin/evaluations");
  return { success: true, message: "Seeded 3 default templates with all questions." };
}

// ---------------------------------------------------------------------------
// upsertEvaluationResponse — save a single question response
// ---------------------------------------------------------------------------

export async function upsertEvaluationResponse(formData: FormData) {
  const supabase = await createClient();

  const evaluationId = formData.get("evaluation_id") as string;
  const questionId = formData.get("question_id") as string;
  const questionType = formData.get("question_type") as string;

  if (!evaluationId || !questionId || !questionType) {
    return { error: "evaluation_id, question_id, and question_type are required" };
  }

  // Build the value columns based on question type
  const row: Record<string, unknown> = {
    evaluation_id: evaluationId,
    question_id: questionId,
    nse_value: null,
    text_value: null,
    numeric_value: null,
    boolean_value: null,
    updated_at: new Date().toISOString(),
  };

  switch (questionType) {
    case "nse_rating": {
      const val = formData.get("value") as string;
      if (val && ["N", "S", "E"].includes(val)) {
        row.nse_value = val;
      }
      break;
    }
    case "free_text":
    case "text_input":
    case "level_placement": {
      row.text_value = (formData.get("value") as string) || null;
      break;
    }
    case "numeric": {
      const num = formData.get("value") as string;
      row.numeric_value = num ? parseFloat(num) : null;
      break;
    }
    case "boolean": {
      const bool = formData.get("value") as string;
      row.boolean_value = bool === "true" ? true : bool === "false" ? false : null;
      break;
    }
    default:
      return { error: `Unknown question_type: ${questionType}` };
  }

  const { error } = await supabase
    .from("student_evaluation_responses")
    .upsert(row, { onConflict: "evaluation_id,question_id" });

  if (error) {
    return { error: `Failed to save response: ${error.message}` };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// submitEvaluation — teacher submits a completed evaluation
// ---------------------------------------------------------------------------

export async function submitEvaluation(formData: FormData) {
  const supabase = await createClient();

  const evaluationId = formData.get("evaluation_id") as string;

  if (!evaluationId) {
    return { error: "evaluation_id is required" };
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("student_evaluations")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", evaluationId);

  if (error) {
    return { error: `Failed to submit evaluation: ${error.message}` };
  }

  // Insert history row
  await supabase.from("student_evaluation_history").insert({
    evaluation_id: evaluationId,
    action: "submitted",
    performed_by: user?.id ?? null,
  });

  revalidatePath("/admin/evaluations");
  return { success: true };
}

// ---------------------------------------------------------------------------
// submitAllForClass — bulk submit all draft evaluations for a class
// ---------------------------------------------------------------------------

export async function submitAllForClass(formData: FormData) {
  const supabase = await createClient();

  const classId = formData.get("class_id") as string;

  if (!classId) {
    return { error: "class_id is required" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  // Find all draft evaluations for this class
  const { data: drafts, error: fetchError } = await supabase
    .from("student_evaluations")
    .select("id")
    .eq("class_id", classId)
    .eq("status", "draft");

  if (fetchError) {
    return { error: `Failed to fetch drafts: ${fetchError.message}` };
  }

  if (!drafts || drafts.length === 0) {
    return { message: "No draft evaluations found for this class." };
  }

  const ids = drafts.map((d) => d.id);

  const { error } = await supabase
    .from("student_evaluations")
    .update({
      status: "submitted",
      submitted_at: now,
      updated_at: now,
    })
    .in("id", ids);

  if (error) {
    return { error: `Failed to bulk submit: ${error.message}` };
  }

  // Insert history rows for each
  const historyRows = ids.map((id) => ({
    evaluation_id: id,
    action: "submitted" as const,
    performed_by: user?.id ?? null,
  }));

  await supabase.from("student_evaluation_history").insert(historyRows);

  revalidatePath("/admin/evaluations");
  return { success: true, count: ids.length };
}

// ---------------------------------------------------------------------------
// requestChanges — admin sends evaluation back to teacher
// ---------------------------------------------------------------------------

export async function requestChanges(formData: FormData) {
  const supabase = await createClient();

  const evaluationId = formData.get("evaluation_id") as string;
  const adminNote = formData.get("admin_note") as string;

  if (!evaluationId) {
    return { error: "evaluation_id is required" };
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("student_evaluations")
    .update({
      status: "changes_requested",
      admin_note: adminNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", evaluationId);

  if (error) {
    return { error: `Failed to request changes: ${error.message}` };
  }

  await supabase.from("student_evaluation_history").insert({
    evaluation_id: evaluationId,
    action: "changes_requested",
    performed_by: user?.id ?? null,
    note: adminNote || null,
  });

  revalidatePath("/admin/evaluations");
  return { success: true };
}

// ---------------------------------------------------------------------------
// approveEvaluation — admin approves a submitted evaluation
// ---------------------------------------------------------------------------

export async function approveEvaluation(formData: FormData) {
  const supabase = await createClient();

  const evaluationId = formData.get("evaluation_id") as string;

  if (!evaluationId) {
    return { error: "evaluation_id is required" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("student_evaluations")
    .update({
      status: "approved",
      approved_by: user?.id ?? null,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", evaluationId);

  if (error) {
    return { error: `Failed to approve evaluation: ${error.message}` };
  }

  await supabase.from("student_evaluation_history").insert({
    evaluation_id: evaluationId,
    action: "approved",
    performed_by: user?.id ?? null,
  });

  revalidatePath("/admin/evaluations");
  return { success: true };
}

// ---------------------------------------------------------------------------
// publishEvaluation — make evaluation visible to parents
// ---------------------------------------------------------------------------

export async function publishEvaluation(formData: FormData) {
  const supabase = await createClient();

  const evaluationId = formData.get("evaluation_id") as string;

  if (!evaluationId) {
    return { error: "evaluation_id is required" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("student_evaluations")
    .update({
      status: "published",
      published_at: now,
      updated_at: now,
    })
    .eq("id", evaluationId);

  if (error) {
    return { error: `Failed to publish evaluation: ${error.message}` };
  }

  await supabase.from("student_evaluation_history").insert({
    evaluation_id: evaluationId,
    action: "published",
    performed_by: user?.id ?? null,
  });

  revalidatePath("/admin/evaluations");
  return { success: true };
}

// ---------------------------------------------------------------------------
// createEvaluationsForClass — generate draft evaluations for all enrolled students
// ---------------------------------------------------------------------------

export async function createEvaluationsForClass(formData: FormData) {
  const supabase = await createClient();

  const classId = formData.get("class_id") as string;
  const templateId = formData.get("template_id") as string;
  const tenantId = formData.get("tenant_id") as string;
  const seasonId = (formData.get("season_id") as string) || null;

  if (!classId || !templateId || !tenantId) {
    return { error: "class_id, template_id, and tenant_id are required" };
  }

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all enrolled students for this class
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("class_id", classId)
    .eq("status", "active");

  if (enrollError) {
    return { error: `Failed to fetch enrollments: ${enrollError.message}` };
  }

  if (!enrollments || enrollments.length === 0) {
    return { message: "No active enrollments found for this class." };
  }

  // Fetch existing evaluations for this class + season to avoid duplicates
  let existingQuery = supabase
    .from("student_evaluations")
    .select("student_id")
    .eq("class_id", classId)
    .eq("template_id", templateId);

  if (seasonId) {
    existingQuery = existingQuery.eq("season_id", seasonId);
  }

  const { data: existingEvals } = await existingQuery;

  const existingStudentIds = new Set(
    (existingEvals || []).map((e) => e.student_id)
  );

  // Build rows for students who don't already have an evaluation
  const newRows = enrollments
    .filter((e) => !existingStudentIds.has(e.student_id))
    .map((e) => ({
      tenant_id: tenantId,
      student_id: e.student_id,
      evaluator_id: user?.id ?? null,
      class_id: classId,
      template_id: templateId,
      season_id: seasonId,
      evaluation_type: "formal" as const,
      status: "draft" as const,
      is_private: false,
    }));

  if (newRows.length === 0) {
    return { message: "All students already have evaluations for this class and season." };
  }

  const { error: insertError } = await supabase
    .from("student_evaluations")
    .insert(newRows);

  if (insertError) {
    return { error: `Failed to create evaluations: ${insertError.message}` };
  }

  // Insert history rows for each new evaluation
  const { data: newEvals } = await supabase
    .from("student_evaluations")
    .select("id")
    .eq("class_id", classId)
    .eq("template_id", templateId)
    .eq("status", "draft")
    .in(
      "student_id",
      newRows.map((r) => r.student_id)
    );

  if (newEvals && newEvals.length > 0) {
    const historyRows = newEvals.map((ev) => ({
      evaluation_id: ev.id,
      action: "created" as const,
      performed_by: user?.id ?? null,
    }));

    await supabase.from("student_evaluation_history").insert(historyRows);
  }

  revalidatePath("/admin/evaluations");
  return { success: true, created: newRows.length };
}
