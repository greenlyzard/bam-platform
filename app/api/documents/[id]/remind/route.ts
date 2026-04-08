import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRawEmail } from "@/lib/email/send";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: doc } = await supabase
    .from("family_documents")
    .select("id, family_id, title, document_type")
    .eq("id", id)
    .single();

  if (!doc || !doc.family_id) {
    return NextResponse.json({ error: "Document or family not found" }, { status: 404 });
  }

  const { data: family } = await supabase
    .from("families")
    .select("primary_contact_id, billing_email")
    .eq("id", doc.family_id)
    .single();

  if (family?.primary_contact_id) {
    await supabase.from("notifications").insert({
      tenant_id: user.tenantId!,
      recipient_id: family.primary_contact_id,
      notification_type: "document_reminder",
      title: "Reminder: action required",
      body: doc.title,
      metadata: { document_id: doc.id },
    });
  }

  if (family?.billing_email) {
    try {
      await sendRawEmail({
        to: family.billing_email,
        subject: `Reminder: ${doc.title}`,
        bodyHtml: `
          <p>This is a friendly reminder that the following document still needs your attention:</p>
          <p><strong>${doc.title}</strong></p>
          <p>
            <a href="https://portal.balletacademyandmovement.com/portal/documents"
               style="background:#9C8BBF;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              View in Portal
            </a>
          </p>
        `,
      });
    } catch (e) {
      console.error("[document:remind] email failed:", e);
    }
  }

  return NextResponse.json({ success: true });
}
