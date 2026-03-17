// =============================================================================
// Communications Module (M1) — Shared Type Definitions
// =============================================================================

// ---------------------------------------------------------------------------
// Inbox Module (unified admin inbox)
// ---------------------------------------------------------------------------

/** Thread in the unified admin inbox (communication_threads table) */
export interface CommunicationThread {
  id: string;
  thread_token: string;
  subject: string | null;
  thread_type: string;
  state: string;
  priority: string;
  contact_name: string | null;
  contact_email: string | null;
  family_id: string | null;
  lead_id: string | null;
  staff_user_id: string | null;
  assigned_to: string | null;
  unread_count: number;
  message_count: number;
  last_message_at: string;
  last_message?: {
    preview: string;
    direction: string;
    sender_name: string | null;
    created_at: string;
  } | null;
}

/** Single message in a communication thread (communication_messages table) */
export interface CommunicationMessage {
  id: string;
  thread_id: string;
  direction: string;
  sender_id: string | null;
  sender_name: string | null;
  sender_email: string | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  matched: boolean;
  template_slug: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Contact Search
// ---------------------------------------------------------------------------

/** Contact returned by /api/communications/contacts/search */
export interface Contact {
  id: string;
  name: string;
  email: string;
  type: "family" | "lead" | "staff";
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

/** Announcement row for admin dashboard */
export interface Announcement {
  id: string;
  title: string;
  audience: string;
  channel: string;
  status: string;
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
  author_name: string;
}

// ---------------------------------------------------------------------------
// Parent Portal (P2P message_threads / messages)
// ---------------------------------------------------------------------------

/** Thread preview for parent portal messages list */
export interface ThreadPreview {
  id: string;
  subject: string | null;
  participant_names: string[];
  last_message_preview: string | null;
  last_message_at: string;
  unread_count: number;
}

/** P2P message in parent portal (messages table) */
export interface PortalMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  is_own: boolean;
  created_at: string;
}

/** Thread data returned by GET /api/communications/messages/[threadId] */
export interface PortalThreadData {
  thread: {
    id: string;
    subject: string | null;
    participants: Record<string, { name: string; role: string }>;
  };
  messages: PortalMessage[];
}

// ---------------------------------------------------------------------------
// Shared / Auth
// ---------------------------------------------------------------------------

/** Current user context for inbox */
export interface InboxUser {
  id: string;
  role: string;
  name: string;
  email: string;
}

/** Staff member for assignment dropdowns */
export interface StaffMember {
  id: string;
  name: string;
}

/** Folder definition for inbox sidebar */
export interface InboxFolder {
  key: string;
  label: string;
  filter: Record<string, string>;
  adminOnly?: boolean;
}
