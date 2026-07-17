import { NextResponse } from "next/server";
import { extendAllActiveClasses } from "@/lib/schedule/generate";

/**
 * Daily cron — extend the rolling occurrence window for every active class and reconcile closures
 * (task 19). Re-running generation flips FUTURE-row status both directions as closures are added or
 * removed; past rows are never touched.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await extendAllActiveClasses();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron:schedule-generate]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
