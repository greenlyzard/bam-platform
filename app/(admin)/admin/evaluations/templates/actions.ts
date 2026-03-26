"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const REVALIDATE_PATH = "/admin/evaluations/templates";

// ---------------------------------------------------------------------------
// 1. createTemplate
// ---------------------------------------------------------------------------

export async function createTemplate(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  const name = formData.get("name") as string;

  if (!tenantId) return { error: "Missing tenant" };
  if (!name) return { error: "Name is required" };

  const { data, error } = await supabase
    .from("evaluation_templates")
    .insert({
      tenant_id: tenantId,
      name,
      slug: slugify(name),
      is_active: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[evaluation_templates:create]", error);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// 2. updateTemplateSettings
// ---------------------------------------------------------------------------

export async function updateTemplateSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing template ID" };

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const levelTag = formData.get("level_tag") as string | null;
  const programTag = formData.get("program_tag") as string | null;
  const isActive = formData.get("is_active") === "true";

  if (!name) return { error: "Name is required" };

  const { error } = await supabase
    .from("evaluation_templates")
    .update({
      name,
      slug: slug || slugify(name),
      level_tag: levelTag || null,
      program_tag: programTag || null,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[evaluation_templates:update]", error);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return {};
}

// ---------------------------------------------------------------------------
// 3. toggleTemplateActive
// ---------------------------------------------------------------------------

export async function toggleTemplateActive(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  const isActive = formData.get("is_active") === "true";
  if (!id) return { error: "Missing template ID" };

  const { error } = await supabase
    .from("evaluation_templates")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[evaluation_templates:toggle_active]", error);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return {};
}

// ---------------------------------------------------------------------------
// 4. duplicateTemplate
// ---------------------------------------------------------------------------

export async function duplicateTemplate(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const templateId = formData.get("id") as string;
  if (!templateId) return { error: "Missing template ID" };

  // Fetch original template
  const { data: original, error: fetchErr } = await supabase
    .from("evaluation_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (fetchErr || !original) {
    console.error("[evaluation_templates:duplicate:fetch]", fetchErr);
    return { error: fetchErr?.message ?? "Template not found" };
  }

  // Create the copy
  const { data: newTemplate, error: insertErr } = await supabase
    .from("evaluation_templates")
    .insert({
      tenant_id: original.tenant_id,
      name: `${original.name} (Copy)`,
      slug: `${original.slug}-copy`,
      level_tag: original.level_tag,
      program_tag: original.program_tag,
      is_active: false,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !newTemplate) {
    console.error("[evaluation_templates:duplicate:insert]", insertErr);
    return { error: insertErr?.message ?? "Failed to create copy" };
  }

  // Fetch original sections
  const { data: sections } = await supabase
    .from("evaluation_template_sections")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order");

  if (sections && sections.length > 0) {
    for (const section of sections) {
      // Insert new section
      const { data: newSection, error: secErr } = await supabase
        .from("evaluation_template_sections")
        .insert({
          template_id: newTemplate.id,
          tenant_id: section.tenant_id,
          title: section.title,
          slug: section.slug,
          display_mode: section.display_mode,
          sort_order: section.sort_order,
        })
        .select("id")
        .single();

      if (secErr || !newSection) {
        console.error("[evaluation_templates:duplicate:section]", secErr);
        continue;
      }

      // Fetch questions for this section
      const { data: questions } = await supabase
        .from("evaluation_template_questions")
        .select("*")
        .eq("section_id", section.id)
        .order("sort_order");

      if (questions && questions.length > 0) {
        const newQuestions = questions.map((q) => ({
          section_id: newSection.id,
          template_id: newTemplate.id,
          tenant_id: q.tenant_id,
          label: q.label,
          slug: q.slug,
          hint_text: q.hint_text,
          question_type: q.question_type,
          is_required: q.is_required,
          sort_order: q.sort_order,
        }));

        const { error: qErr } = await supabase
          .from("evaluation_template_questions")
          .insert(newQuestions);

        if (qErr) {
          console.error("[evaluation_templates:duplicate:questions]", qErr);
        }
      }
    }
  }

  revalidatePath(REVALIDATE_PATH);
  return { id: newTemplate.id };
}

// ---------------------------------------------------------------------------
// 5. addSection
// ---------------------------------------------------------------------------

export async function addSection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const templateId = formData.get("template_id") as string;
  const tenantId = formData.get("tenant_id") as string;
  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const displayMode = formData.get("display_mode") as string | null;

  if (!templateId) return { error: "Missing template ID" };
  if (!tenantId) return { error: "Missing tenant" };
  if (!title) return { error: "Title is required" };

  // Determine next sort_order
  const { data: maxRow } = await supabase
    .from("evaluation_template_sections")
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("evaluation_template_sections")
    .insert({
      template_id: templateId,
      tenant_id: tenantId,
      title,
      slug: slug || slugify(title),
      display_mode: displayMode || null,
      sort_order: nextSort,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[evaluation_template_sections:add]", error);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// 6. updateSection
// ---------------------------------------------------------------------------

export async function updateSection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing section ID" };

  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const displayMode = formData.get("display_mode") as string | null;

  if (!title) return { error: "Title is required" };

  const { error } = await supabase
    .from("evaluation_template_sections")
    .update({
      title,
      slug: slug || slugify(title),
      display_mode: displayMode || null,
    })
    .eq("id", id);

  if (error) {
    console.error("[evaluation_template_sections:update]", error);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return {};
}

// ---------------------------------------------------------------------------
// 7. deleteSection
// ---------------------------------------------------------------------------

export async function deleteSection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing section ID" };

  const { error } = await supabase
    .from("evaluation_template_sections")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[evaluation_template_sections:delete]", error);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return {};
}

// ---------------------------------------------------------------------------
// 8. reorderSections
// ---------------------------------------------------------------------------

export async function reorderSections(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const templateId = formData.get("templateId") as string;
  const orderedIdsRaw = formData.get("orderedIds") as string;

  if (!templateId) return { error: "Missing template ID" };
  if (!orderedIdsRaw) return { error: "Missing ordered IDs" };

  let orderedIds: string[];
  try {
    orderedIds = JSON.parse(orderedIdsRaw);
  } catch {
    return { error: "Invalid orderedIds JSON" };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("evaluation_template_sections")
      .update({ sort_order: i + 1 })
      .eq("id", orderedIds[i])
      .eq("template_id", templateId);

    if (error) {
      console.error("[evaluation_template_sections:reorder]", error);
      return { error: error.message };
    }
  }

  revalidatePath(REVALIDATE_PATH);
  return {};
}

// ---------------------------------------------------------------------------
// 9. addQuestionToSection
// ---------------------------------------------------------------------------

export async function addQuestionToSection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sectionId = formData.get("section_id") as string;
  const templateId = formData.get("template_id") as string;
  const tenantId = formData.get("tenant_id") as string;
  const questionBankId = formData.get("question_bank_id") as string | null;

  if (!sectionId) return { error: "Missing section ID" };
  if (!templateId) return { error: "Missing template ID" };
  if (!tenantId) return { error: "Missing tenant" };

  // Determine next sort_order
  const { data: maxRow } = await supabase
    .from("evaluation_template_questions")
    .select("sort_order")
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = (maxRow?.sort_order ?? 0) + 1;

  let label: string;
  let slug: string;
  let questionType: string;
  let hintText: string | null;

  if (questionBankId) {
    // Copy from question bank
    const { data: bankQ, error: bankErr } = await supabase
      .from("evaluation_question_bank")
      .select("label, slug, hint_text, question_type")
      .eq("id", questionBankId)
      .single();

    if (bankErr || !bankQ) {
      console.error("[evaluation_template_questions:add:bank_lookup]", bankErr);
      return { error: bankErr?.message ?? "Question not found in bank" };
    }

    label = bankQ.label;
    slug = bankQ.slug;
    questionType = bankQ.question_type;
    hintText = bankQ.hint_text;
  } else {
    // Direct fields
    label = formData.get("label") as string;
    slug = formData.get("slug") as string;
    questionType = formData.get("question_type") as string;
    hintText = formData.get("hint_text") as string | null;

    if (!label) return { error: "Label is required" };
    if (!questionType) return { error: "Question type is required" };
  }

  const { data, error } = await supabase
    .from("evaluation_template_questions")
    .insert({
      section_id: sectionId,
      template_id: templateId,
      tenant_id: tenantId,
      label,
      slug: slug || slugify(label),
      question_type: questionType,
      hint_text: hintText || null,
      is_required: false,
      sort_order: nextSort,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[evaluation_template_questions:add]", error);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// 10. removeQuestion
// ---------------------------------------------------------------------------

export async function removeQuestion(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing question ID" };

  const { error } = await supabase
    .from("evaluation_template_questions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[evaluation_template_questions:remove]", error);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return {};
}

// ---------------------------------------------------------------------------
// 11. updateQuestion
// ---------------------------------------------------------------------------

export async function updateQuestion(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing question ID" };

  const label = formData.get("label") as string;
  const isRequired = formData.get("is_required") === "true";
  const hintText = formData.get("hint_text") as string | null;

  if (!label) return { error: "Label is required" };

  const { error } = await supabase
    .from("evaluation_template_questions")
    .update({
      label,
      is_required: isRequired,
      hint_text: hintText || null,
    })
    .eq("id", id);

  if (error) {
    console.error("[evaluation_template_questions:update]", error);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return {};
}

// ---------------------------------------------------------------------------
// 12. reorderQuestions
// ---------------------------------------------------------------------------

export async function reorderQuestions(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sectionId = formData.get("sectionId") as string;
  const orderedIdsRaw = formData.get("orderedIds") as string;

  if (!sectionId) return { error: "Missing section ID" };
  if (!orderedIdsRaw) return { error: "Missing ordered IDs" };

  let orderedIds: string[];
  try {
    orderedIds = JSON.parse(orderedIdsRaw);
  } catch {
    return { error: "Invalid orderedIds JSON" };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("evaluation_template_questions")
      .update({ sort_order: i + 1 })
      .eq("id", orderedIds[i])
      .eq("section_id", sectionId);

    if (error) {
      console.error("[evaluation_template_questions:reorder]", error);
      return { error: error.message };
    }
  }

  revalidatePath(REVALIDATE_PATH);
  return {};
}

// ---------------------------------------------------------------------------
// 13. createCustomQuestion
// ---------------------------------------------------------------------------

export async function createCustomQuestion(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  const label = formData.get("label") as string;
  const questionType = formData.get("question_type") as string;
  const hintText = formData.get("hint_text") as string | null;
  const defaultSection = formData.get("default_section") as string | null;

  if (!tenantId) return { error: "Missing tenant" };
  if (!label) return { error: "Label is required" };
  if (!questionType) return { error: "Question type is required" };

  const { data, error } = await supabase
    .from("evaluation_question_bank")
    .insert({
      tenant_id: tenantId,
      label,
      slug: slugify(label),
      question_type: questionType,
      hint_text: hintText || null,
      default_section: defaultSection || null,
      is_global: false,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[evaluation_question_bank:create_custom]", error);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { id: data.id };
}
