import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { InboxLayout } from "./InboxLayout";

export default async function InboxPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name, email")
    .eq("id", user.id)
    .single();

  // Fetch staff list for assignment dropdown
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role")
    .in("role", ["super_admin", "admin", "teacher"])
    .order("first_name");

  return (
    <InboxLayout
      currentUser={{
        id: profile?.id ?? user.id,
        role: profile?.role ?? "admin",
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "",
        email: profile?.email ?? user.email,
      }}
      staffList={
        (staff ?? []).map((s) => ({
          id: s.id,
          name: [s.first_name, s.last_name].filter(Boolean).join(" ") || s.email,
        }))
      }
    />
  );
}
