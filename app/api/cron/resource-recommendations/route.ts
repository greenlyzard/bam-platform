import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { generateRecommendations } from "@/lib/resources/recommendations";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Get all active tenants
  const { data: tenants, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name");

  if (tenantError || !tenants) {
    return NextResponse.json(
      { error: "Failed to fetch tenants" },
      { status: 500 }
    );
  }

  const results: { tenantId: string; generated: number }[] = [];

  for (const tenant of tenants) {
    const recommendations = await generateRecommendations(tenant.id);
    results.push({
      tenantId: tenant.id,
      generated: recommendations.length,
    });
  }

  return NextResponse.json({
    success: true,
    results,
    timestamp: new Date().toISOString(),
  });
}
