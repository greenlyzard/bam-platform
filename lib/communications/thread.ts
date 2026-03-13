import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

const REPLY_DOMAIN = "mail.balletacademyandmovement.com";
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Generate a deterministic 8-character base62 thread token.
 */
export function generateThreadToken(
  messageId: string,
  tenantId: string
): string {
  const hash = createHash("sha256")
    .update(`${tenantId}:${messageId}`)
    .digest();
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += BASE62[hash[i] % 62];
  }
  return result;
}

/**
 * Build a reply-to address from a thread token.
 */
export function buildReplyTo(threadToken: string): string {
  return `reply+${threadToken}@${REPLY_DOMAIN}`;
}

/**
 * Extract a thread token from a reply-to address.
 * Returns null if the address doesn't match the expected format.
 */
export function extractThreadToken(toAddress: string): string | null {
  const match = toAddress.match(/^reply\+([A-Za-z0-9]{8})@/);
  return match ? match[1] : null;
}

interface ThreadParams {
  tenantId: string;
  threadToken: string;
  subject?: string;
  threadType?: "direct" | "system" | "announcement" | "bulk";
  channel?: "email" | "sms" | "in_app" | "system";
  familyId?: string | null;
  leadId?: string | null;
  staffUserId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  assignedTo?: string | null;
  createdBy?: string | null;
}

/**
 * Look up a thread by token, or create one if it doesn't exist.
 */
export async function getOrCreateThread(params: ThreadParams) {
  const supabase = await createClient();

  // Try to find existing thread
  const { data: existing } = await supabase
    .from("communication_threads")
    .select("*")
    .eq("thread_token", params.threadToken)
    .single();

  if (existing) return existing;

  // Create new thread
  const { data: thread, error } = await supabase
    .from("communication_threads")
    .insert({
      tenant_id: params.tenantId,
      thread_token: params.threadToken,
      subject: params.subject ?? null,
      thread_type: params.threadType ?? "direct",
      channel: params.channel ?? "email",
      family_id: params.familyId ?? null,
      lead_id: params.leadId ?? null,
      staff_user_id: params.staffUserId ?? null,
      contact_name: params.contactName ?? null,
      contact_email: params.contactEmail ?? null,
      assigned_to: params.assignedTo ?? null,
      created_by: params.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return thread;
}

interface MessageInsert {
  tenantId: string;
  threadId: string;
  direction: "inbound" | "outbound" | "system";
  senderId?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  matched?: boolean;
  templateSlug?: string | null;
}

/**
 * Append a message to a thread and update thread metadata.
 */
export async function appendMessage(params: MessageInsert) {
  const supabase = await createClient();

  const { data: message, error: msgError } = await supabase
    .from("communication_messages")
    .insert({
      tenant_id: params.tenantId,
      thread_id: params.threadId,
      direction: params.direction,
      sender_id: params.senderId ?? null,
      sender_name: params.senderName ?? null,
      sender_email: params.senderEmail ?? null,
      subject: params.subject ?? null,
      body_html: params.bodyHtml ?? null,
      body_text: params.bodyText ?? null,
      matched: params.matched ?? true,
      template_slug: params.templateSlug ?? null,
    })
    .select("*")
    .single();

  if (msgError) throw msgError;

  // Update thread counters
  const updates: Record<string, unknown> = {
    last_message_at: new Date().toISOString(),
    message_count: undefined, // handled by rpc below
  };

  // Increment unread_count for inbound messages
  if (params.direction === "inbound") {
    await supabase.rpc("increment_thread_unread", {
      p_thread_id: params.threadId,
    }).then(({ error }) => {
      // If RPC doesn't exist, fall back to manual update
      if (error) {
        return supabase
          .from("communication_threads")
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: 1, // Will be at least 1
          })
          .eq("id", params.threadId);
      }
    });
  }

  // Always update last_message_at
  await supabase
    .from("communication_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", params.threadId);

  return message;
}
