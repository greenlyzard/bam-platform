import { redirect } from "next/navigation";

/**
 * The Communications hub now lives at /admin/communications/groups.
 * This route exists only to forward the existing nav item / module link.
 */
export default function CommunicationsPage() {
  redirect("/admin/communications/groups");
}
