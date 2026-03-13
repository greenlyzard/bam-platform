import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Search knowledge articles by keyword relevance using PostgreSQL full-text search.
 * Returns the top matching articles to inject into Angelina's system prompt.
 */
export async function searchKnowledgeArticles(
  supabase: SupabaseClient,
  query: string,
  tenantId: string,
  audience: string,
  limit = 3
): Promise<{ title: string; content: string; category: string }[]> {
  // Clean query: remove very short words, limit length
  const cleaned = query
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 10)
    .join(" & ");

  if (!cleaned) return [];

  // Full-text search with ranking
  const { data: articles } = await supabase
    .from("knowledge_articles")
    .select("title, content, category")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .or(`audience.cs.{${audience}},audience.cs.{all}`)
    .textSearch("search_vector", cleaned, { type: "websearch" })
    .limit(limit);

  if (articles && articles.length > 0) return articles;

  // Fallback: simple ILIKE search on title if full-text returns nothing
  const words = query
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  if (words.length === 0) return [];

  const ilikeFilters = words.map((w) => `title.ilike.%${w}%,content.ilike.%${w}%`);

  const { data: fallback } = await supabase
    .from("knowledge_articles")
    .select("title, content, category")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .or(`audience.cs.{${audience}},audience.cs.{all}`)
    .or(ilikeFilters.join(","))
    .limit(limit);

  return fallback ?? [];
}
