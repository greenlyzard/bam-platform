"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateTemplateSchema = z.object({
  slug: z.string().min(1),
  from_name: z.string().min(1, "From name is required").max(200),
  from_email: z.string().email("Valid email required"),
  reply_to: z.string().email("Valid email required").optional().or(z.literal("")),
  subject: z.string().min(1, "Subject is required").max(500),
  header_text: z.string().max(500).optional().or(z.literal("")),
  body_html: z.string().min(1, "Body content is required"),
  button_text: z.string().max(200).optional().or(z.literal("")),
  button_url: z.string().max(1000).optional().or(z.literal("")),
  footer_text: z.string().max(1000).optional().or(z.literal("")),
  is_active: z.boolean(),
});

export async function updateEmailTemplate(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const parsed = updateTemplateSchema.safeParse({
    slug: formData.get("slug"),
    from_name: formData.get("from_name"),
    from_email: formData.get("from_email"),
    reply_to: formData.get("reply_to") || "",
    subject: formData.get("subject"),
    header_text: formData.get("header_text") || "",
    body_html: formData.get("body_html"),
    button_text: formData.get("button_text") || "",
    button_url: formData.get("button_url") || "",
    footer_text: formData.get("footer_text") || "",
    is_active: formData.get("is_active") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { slug, ...fields } = parsed.data;

  const { error } = await supabase
    .from("email_templates")
    .update({
      ...fields,
      reply_to: fields.reply_to || null,
      header_text: fields.header_text || null,
      button_text: fields.button_text || null,
      button_url: fields.button_url || null,
      footer_text: fields.footer_text || null,
      updated_by: user.id,
    })
    .eq("slug", slug);

  if (error) {
    console.error("[admin:updateEmailTemplate]", error);
    return { error: "Failed to save template. Please try again." };
  }

  revalidatePath("/admin/emails");
  revalidatePath(`/admin/emails/${slug}`);
  return { success: true };
}
