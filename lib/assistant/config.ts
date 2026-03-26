import { createClient } from "@/lib/supabase/server";

export interface AssistantConfig {
  assistantName: string;
  assistantAvatarUrl: string | null;
  directorName: string;
  greetingMessage: string;
  primaryColor: string;
  enrollmentEnabled: boolean;
  trialEnabled: boolean;
}

const DEFAULT_CONFIG: AssistantConfig = {
  assistantName: "Angelina",
  assistantAvatarUrl: null,
  directorName: "Miss Amanda",
  greetingMessage: "Welcome! I'm here to help you find the perfect class.",
  primaryColor: "#9C8BBF",
  enrollmentEnabled: true,
  trialEnabled: true,
};

// Simple in-memory cache with 60s TTL
let cache: { config: AssistantConfig; tenantId: string; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function getAssistantConfig(tenantId: string): Promise<AssistantConfig> {
  if (cache && cache.tenantId === tenantId && Date.now() - cache.ts < CACHE_TTL) {
    return cache.config;
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tenant_assistant_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (!data) return DEFAULT_CONFIG;

    const config: AssistantConfig = {
      assistantName: data.assistant_name ?? DEFAULT_CONFIG.assistantName,
      assistantAvatarUrl: data.assistant_avatar_url ?? null,
      directorName: data.director_name ?? DEFAULT_CONFIG.directorName,
      greetingMessage: data.greeting_message ?? DEFAULT_CONFIG.greetingMessage,
      primaryColor: data.primary_color ?? DEFAULT_CONFIG.primaryColor,
      enrollmentEnabled: data.enrollment_enabled ?? true,
      trialEnabled: data.trial_enabled ?? true,
    };

    cache = { config, tenantId, ts: Date.now() };
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}
