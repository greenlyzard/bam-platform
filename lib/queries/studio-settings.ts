import { createClient } from "@/lib/supabase/server";

export async function getStudioSettings() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("studio_settings")
    .select("*")
    .limit(1)
    .single();
  return data;
}
