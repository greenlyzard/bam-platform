import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";

const DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

function formatTime(time: string): string {
  if (!time) return "TBD";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

/**
 * Send 24-hour class reminders for all classes happening tomorrow.
 * Idempotent — checks class_reminders table to avoid duplicates.
 */
export async function sendClassReminders(): Promise<{
  sent: number;
  skipped: number;
  errors: number;
}> {
  const supabase = await createClient();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const tomorrowDay = DAYS[tomorrow.getDay()];

  // Get all class instances for tomorrow
  const { data: instances } = await supabase
    .from("schedule_instances")
    .select(
      "id, class_id, teacher_id, event_date, start_time, end_time, status, classes(name)"
    )
    .eq("event_date", tomorrowStr)
    .eq("event_type", "class")
    .in("status", ["published", "approved", "notified"]);

  if (!instances || instances.length === 0) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  // Check which reminders have already been sent
  const instanceIds = instances.map((i) => i.id);
  const { data: existingReminders } = await supabase
    .from("class_reminders")
    .select("schedule_instance_id")
    .in("schedule_instance_id", instanceIds);

  const alreadySent = new Set(
    (existingReminders ?? []).map((r) => r.schedule_instance_id)
  );

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const instance of instances) {
    if (alreadySent.has(instance.id)) {
      skipped++;
      continue;
    }

    const className = (instance as any).classes?.name ?? "Class";
    const timeStr = formatTime(instance.start_time);

    // Get teacher name
    let teacherName = "Your instructor";
    if (instance.teacher_id) {
      const { data: teacher } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", instance.teacher_id)
        .single();
      if (teacher) {
        teacherName = [teacher.first_name, teacher.last_name]
          .filter(Boolean)
          .join(" ");
      }
    }

    // Get enrolled students and their parents
    if (!instance.class_id) {
      skipped++;
      continue;
    }

    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("student_id, students(first_name, parent_id)")
      .eq("class_id", instance.class_id)
      .in("status", ["active", "trial"]);

    if (!enrollments || enrollments.length === 0) {
      skipped++;
      continue;
    }

    // Group by parent to send one email per parent
    const parentStudents = new Map<string, string[]>();
    for (const e of enrollments) {
      const student = (e as any).students;
      if (!student?.parent_id) continue;
      const names = parentStudents.get(student.parent_id) ?? [];
      names.push(student.first_name);
      parentStudents.set(student.parent_id, names);
    }

    const parentIds = [...parentStudents.keys()];
    if (parentIds.length === 0) {
      skipped++;
      continue;
    }

    const { data: parents } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", parentIds);

    let recipientCount = 0;

    for (const parent of parents ?? []) {
      if (!parent.email) continue;
      const studentNames = parentStudents.get(parent.id) ?? ["your dancer"];
      const studentNameStr = studentNames.join(" & ");

      const dateStr = `${tomorrowDay}, ${tomorrow.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })}`;

      const result = await sendEmail("class_reminder", parent.email, {
        class_name: className,
        time: timeStr,
        date: dateStr,
        teacher_name: teacherName,
        student_name: studentNameStr,
      });

      if (result.success) {
        recipientCount++;
      } else {
        console.error(
          `[reminders] Failed to send to ${parent.email}:`,
          result.error
        );
        errors++;
      }
    }

    // Record that this reminder was sent
    await supabase.from("class_reminders").insert({
      schedule_instance_id: instance.id,
      class_id: instance.class_id,
      reminder_date: tomorrowStr,
      recipient_count: recipientCount,
    });

    sent += recipientCount;
  }

  return { sent, skipped, errors };
}
