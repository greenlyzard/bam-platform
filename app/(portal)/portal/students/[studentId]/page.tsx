import { requireParent } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import {
  getStudentDetail,
  getStudentAttendanceSummary,
  getStudentContacts,
} from "@/lib/queries/portal";
import { calculateAge } from "@/lib/utils";
import Link from "next/link";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-[#5A9E6F]/10 text-[#5A9E6F]",
  trial: "bg-lavender/10 text-lavender-dark",
  waitlist: "bg-[#D4A843]/10 text-[#D4A843]",
  pending_payment: "bg-[#D4A843]/10 text-[#D4A843]",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requireParent();
  const { studentId } = await params;

  const [student, attendance, contacts] = await Promise.all([
    getStudentDetail(studentId),
    getStudentAttendanceSummary(studentId),
    getStudentContacts(studentId),
  ]);

  if (!student) notFound();

  const age = calculateAge(student.date_of_birth);
  const initials = `${student.first_name[0]}${student.last_name[0]}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal/dashboard"
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Profile Header */}
      <div className="rounded-xl border border-silver bg-white p-5">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-lavender-light flex items-center justify-center text-lg font-bold text-lavender-dark shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-heading font-semibold text-charcoal">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-sm text-slate mt-1">
              Age {age}
              {student.current_level ? ` · ${student.current_level}` : ""}
            </p>
            {student.medical_notes && (
              <p className="text-xs text-mist mt-2">
                Medical: {student.medical_notes}
              </p>
            )}
            {student.allergy_notes && (
              <p className="text-xs text-[#D4A843] mt-1">
                Allergies: {student.allergy_notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          This Month&apos;s Attendance
        </h2>
        {attendance.total === 0 ? (
          <p className="text-sm text-mist">No attendance records this month.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AttendanceStat label="Present" count={attendance.present} color="text-[#5A9E6F]" />
            <AttendanceStat label="Absent" count={attendance.absent} color="text-[#C45B5B]" />
            <AttendanceStat label="Late" count={attendance.late} color="text-[#D4A843]" />
            <AttendanceStat label="Excused" count={attendance.excused} color="text-slate" />
          </div>
        )}
      </div>

      {/* Enrolled Classes */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          Enrolled Classes
        </h2>
        {student.enrollments.length === 0 ? (
          <p className="text-sm text-mist">Not currently enrolled in any classes.</p>
        ) : (
          <div className="divide-y divide-silver/50">
            {student.enrollments.map((e: {
              id: string;
              status: string;
              enrollment_type: string;
              classes: {
                name: string;
                simple_name: string | null;
                day_of_week: number | null;
                start_time: string | null;
                end_time: string | null;
                room: string | null;
              } | null;
            }) => {
              const cls = (
                Array.isArray(e.classes) ? e.classes[0] : e.classes
              ) as {
                name: string;
                simple_name: string | null;
                day_of_week: number | null;
                start_time: string | null;
                end_time: string | null;
                room: string | null;
              } | null;

              if (!cls) return null;

              return (
                <div key={e.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-charcoal text-sm">
                      {cls.simple_name || cls.name}
                    </p>
                    <p className="text-xs text-mist">
                      {cls.day_of_week != null
                        ? `${DAY_NAMES[cls.day_of_week]} ${formatTime(cls.start_time)} - ${formatTime(cls.end_time)}`
                        : "Schedule TBD"}
                      {cls.room ? ` · ${cls.room}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      STATUS_COLORS[e.status] ?? "bg-cloud text-slate"
                    }`}
                  >
                    {e.status.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contacts */}
      {contacts.length > 0 && (
        <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Family Contacts
          </h2>
          <div className="divide-y divide-silver/50">
            {contacts.map((c: {
              id: string;
              first_name: string;
              last_name: string;
              relationship: string | null;
              phone: string | null;
              email: string | null;
              contact_type: string;
              is_primary: boolean;
            }) => (
              <div key={c.id} className="py-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-charcoal text-sm">
                    {c.first_name} {c.last_name}
                  </p>
                  {c.is_primary && (
                    <span className="text-xs text-lavender">Primary</span>
                  )}
                  <span className="text-xs text-mist capitalize">
                    {c.contact_type}
                  </span>
                </div>
                <p className="text-xs text-mist">
                  {c.relationship ?? ""}
                  {c.phone ? ` · ${c.phone}` : ""}
                  {c.email ? ` · ${c.email}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="text-center rounded-lg border border-silver/50 p-3">
      <p className={`text-2xl font-semibold ${color}`}>{count}</p>
      <p className="text-xs text-mist mt-1">{label}</p>
    </div>
  );
}
