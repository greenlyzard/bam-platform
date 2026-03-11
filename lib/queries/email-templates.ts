import { createClient } from "@/lib/supabase/server";

export async function getAllEmailTemplates() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select(
      "id, slug, name, description, is_active, updated_at, updated_by"
    )
    .order("name");

  if (error) {
    console.error("[email-templates:getAll]", error);
    return [];
  }

  return data ?? [];
}

export async function getEmailTemplateBySlug(slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("[email-templates:getBySlug]", error);
    return null;
  }

  return data;
}
