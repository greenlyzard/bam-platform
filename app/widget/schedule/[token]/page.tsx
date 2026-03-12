import { getEmbedConfig } from "@/lib/calendar/queries";
import { ScheduleWidget } from "./schedule-widget";

export default async function WidgetSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const resolvedSearch = await searchParams;

  const embed = await getEmbedConfig(token);

  if (!embed) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
          fontFamily: "system-ui, sans-serif",
          color: "#6B6B7B",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.1rem", marginBottom: 8 }}>
            Schedule not available
          </p>
          <p style={{ fontSize: "0.85rem" }}>
            Please contact the studio at (949) 229-0846
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScheduleWidget
      token={token}
      embedConfig={embed}
      initialWeek={resolvedSearch.week}
      initialMode={
        (resolvedSearch.mode as "week" | "list" | "print") ?? embed.display_mode
      }
    />
  );
}
