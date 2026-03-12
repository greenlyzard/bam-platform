import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth/guards";
import { sendClassReminders } from "@/lib/communications/send-reminders";

/**
 * POST /api/communications/reminders
 *
 * Sends 24-hour class reminders. Can be triggered by:
 * 1. Vercel Cron (with x-cron-secret header)
 * 2. Admin manually via dashboard
 */
export async function POST(req: NextRequest) {
  // Check for cron secret or admin auth
  const cronSecret = req.headers.get("x-cron-secret");
  const isValidCron =
    cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  if (!isValidCron) {
    const user = await getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "super_admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
  }

  try {
    const result = await sendClassReminders();
    return Response.json({
      success: true,
      sent: result.sent,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (err) {
    console.error("[reminders:post] Error:", err);
    return Response.json(
      { error: "Failed to send reminders" },
      { status: 500 }
    );
  }
}
