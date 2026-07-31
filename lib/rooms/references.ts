/**
 * Room reference counting — the shared vocabulary for "what still points at
 * this room".
 *
 * Every foreign key into `rooms` is ON DELETE SET NULL:
 *   classes.room_id, schedule_instances.room_id, schedule_templates.room_id
 *
 * So a DELETE against `rooms` never fails. It succeeds and silently nulls
 * `room_id` on every referencing row, quietly detaching that history from the
 * room it happened in. "Did the delete error?" is therefore not a test of
 * whether a room is safe to delete — the references have to be counted first,
 * on the server, and the count is what decides.
 *
 * All three tables count. A classes-only check would call the three retired
 * orphan rooms deletable even though 61 schedule_instances point at them.
 */

/** Rows pointing at one room, per table, plus their sum. */
export interface RoomReferenceCounts {
  classes: number;
  schedule_instances: number;
  schedule_templates: number;
  /** Sum of the three. Zero — and only zero — makes a room deletable. */
  total: number;
}

function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/**
 * Human sentence naming what uses a room, e.g.
 * "Used by 27 scheduled occurrences." — empty string when nothing does.
 *
 * Shared by the server action (which puts it in the refusal message) and the
 * admin UI (which puts it next to the disabled Delete button) so the two can
 * never explain the same number differently.
 */
export function describeRoomReferences(counts: RoomReferenceCounts): string {
  const parts: string[] = [];
  if (counts.classes > 0) {
    parts.push(countLabel(counts.classes, "class", "classes"));
  }
  if (counts.schedule_instances > 0) {
    parts.push(
      countLabel(
        counts.schedule_instances,
        "scheduled occurrence",
        "scheduled occurrences"
      )
    );
  }
  if (counts.schedule_templates > 0) {
    parts.push(
      countLabel(counts.schedule_templates, "schedule template", "schedule templates")
    );
  }
  if (parts.length === 0) return "";
  return `Used by ${joinList(parts)}.`;
}
