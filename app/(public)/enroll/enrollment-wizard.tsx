"use client";

import { useState } from "react";
import { enrollStudent, bookTrialClass } from "./actions";

interface ClassInfo {
  id: string;
  name: string;
  style: string;
  level: string;
  description: string | null;
  ageMin: number | null;
  ageMax: number | null;
  maxStudents: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  teacherName: string | null;
  activeCount: number;
  spotsRemaining: number;
  isFull: boolean;
}

type Step = "quiz" | "results" | "auth" | "student" | "confirm" | "done";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STYLE_LABELS: Record<string, string> = {
  ballet: "Ballet",
  pre_ballet: "Pre-Ballet",
  creative_movement: "Creative Movement",
  pointe: "Pointe",
  jazz: "Jazz",
  contemporary: "Contemporary",
  lyrical: "Lyrical",
  musical_theatre: "Musical Theatre",
};

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function EnrollmentWizard({ classes }: { classes: ClassInfo[] }) {
  const [step, setStep] = useState<Step>("quiz");

  // Quiz state
  const [childAge, setChildAge] = useState<number | null>(null);
  const [experience, setExperience] = useState("");
  const [interest, setInterest] = useState("");
  const [preferredDay, setPreferredDay] = useState<number | null>(null);

  // Results state
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [recommendedClasses, setRecommendedClasses] = useState<ClassInfo[]>([]);

  // Student state (for new students via authenticated flow)
  const [studentName, setStudentName] = useState("");
  const [studentDob, setStudentDob] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [existingStudents, setExistingStudents] = useState<
    { id: string; first_name: string; last_name: string }[]
  >([]);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");

  // Enrollment result
  const [enrollResult, setEnrollResult] = useState<{
    status: "active" | "waitlist";
    className: string;
    ageWarning?: string | null;
  } | null>(null);

  // Trial flow
  const [showTrial, setShowTrial] = useState(false);
  const [trialEmail, setTrialEmail] = useState("");
  const [trialChildName, setTrialChildName] = useState("");
  const [trialResult, setTrialResult] = useState("");

  // Loading & errors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Quiz Logic ─────────────────────────────────────
  function handleQuizSubmit() {
    if (childAge === null || !experience) return;

    let matches = classes.filter((cls) => {
      if (cls.ageMin && childAge < cls.ageMin - 1) return false;
      if (cls.ageMax && childAge > cls.ageMax + 1) return false;
      return true;
    });

    // Filter by interest
    if (interest && interest !== "not_sure") {
      const styleMap: Record<string, string[]> = {
        ballet: ["ballet", "pre_ballet", "creative_movement"],
        jazz: ["jazz"],
        contemporary: ["contemporary", "lyrical"],
        musical_theatre: ["musical_theatre"],
      };
      const styles = styleMap[interest] ?? [];
      const filtered = matches.filter((c) => styles.includes(c.style));
      if (filtered.length > 0) matches = filtered;
    }

    // Filter by day
    if (preferredDay !== null) {
      const dayFiltered = matches.filter((c) => c.dayOfWeek === preferredDay);
      if (dayFiltered.length > 0) matches = dayFiltered;
    }

    // Sort by level match
    const levelPriority: Record<string, string[]> = {
      none: ["petite", "beginner", "open"],
      some: ["beginner", "petite", "open"],
      yes: ["intermediate", "beginner", "advanced", "open"],
    };
    const priorities = levelPriority[experience] ?? ["beginner"];
    matches.sort((a, b) => {
      const aIdx = priorities.indexOf(a.level);
      const bIdx = priorities.indexOf(b.level);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    setRecommendedClasses(matches.slice(0, 3));
    setStep("results");
  }

  function selectClass(cls: ClassInfo) {
    setSelectedClass(cls);
    // Check if user is already authenticated
    checkAuth();
  }

  async function checkAuth() {
    try {
      const res = await fetch("/api/enroll/check-auth");
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
        setExistingStudents(data.students ?? []);
        setStep("student");
      } else {
        setStep("auth");
      }
    } catch {
      setStep("auth");
    }
  }

  // ─── Auth ───────────────────────────────────────────
  async function handleAuth(formData: FormData) {
    setLoading(true);
    setError("");

    const endpoint =
      authMode === "signup" ? "/api/enroll/signup" : "/api/enroll/signin";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          phone: formData.get("phone"),
          referralSource: formData.get("referralSource"),
        }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setIsAuthenticated(true);
        setExistingStudents(data.students ?? []);
        setStep("student");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Student Profile ────────────────────────────────
  async function handleAddStudent() {
    if (!studentName.trim() || !studentDob) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/enroll/add-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: studentName.split(" ")[0],
          lastName: studentName.split(" ").slice(1).join(" ") || "",
          dateOfBirth: studentDob,
          medicalNotes: medicalNotes || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setStudentId(data.studentId);
        setStep("confirm");
      }
    } catch {
      setError("Failed to add student. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function selectExistingStudent(id: string) {
    setStudentId(id);
    setStep("confirm");
  }

  // ─── Enrollment ─────────────────────────────────────
  async function handleEnroll() {
    if (!studentId || !selectedClass) return;
    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("classId", selectedClass.id);

    const result = await enrollStudent(fd);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.success) {
      setEnrollResult({
        status: result.status!,
        className: result.className!,
        ageWarning: result.ageWarning,
      });
      setStep("done");
    }
    setLoading(false);
  }

  // ─── Trial Booking ──────────────────────────────────
  async function handleBookTrial() {
    if (!trialChildName || !trialEmail || !selectedClass) return;
    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.set("childName", trialChildName);
    fd.set("childAge", String(childAge ?? 5));
    fd.set("email", trialEmail);
    fd.set("classId", selectedClass.id);
    // Default trial date to next occurrence of the class day
    const today = new Date();
    const daysUntil =
      ((selectedClass.dayOfWeek - today.getDay() + 7) % 7) || 7;
    const trialDate = new Date(today.getTime() + daysUntil * 86400000);
    fd.set("trialDate", trialDate.toISOString().split("T")[0]);

    const result = await bookTrialClass(fd);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setTrialResult(result.message!);
    }
  }

  // ─── Render Steps ───────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {["quiz", "results", "auth", "student", "confirm", "done"].map(
          (s, i) => {
            const steps: Step[] = [
              "quiz",
              "results",
              "auth",
              "student",
              "confirm",
              "done",
            ];
            const currentIdx = steps.indexOf(step);
            const isActive = i <= currentIdx;
            return (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-colors ${
                  i <= 1 || (i >= 2 && !showTrial)
                    ? isActive
                      ? "bg-lavender w-10"
                      : "bg-silver w-10"
                    : "hidden"
                }`}
              />
            );
          }
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* ─── Step 1: Quiz ──────────────────────────── */}
      {step === "quiz" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              Find the right class
            </h2>
            <p className="mt-2 text-sm text-slate">
              Answer a few quick questions and we&apos;ll recommend the best fit
              for your child.
            </p>
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              How old is your child?
            </label>
            <div className="flex flex-wrap gap-2">
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
                (age) => (
                  <button
                    key={age}
                    type="button"
                    onClick={() => setChildAge(age)}
                    className={`h-10 w-12 rounded-lg border text-sm font-medium transition-colors ${
                      childAge === age
                        ? "bg-lavender text-white border-lavender"
                        : "bg-white border-silver text-charcoal hover:border-lavender"
                    }`}
                  >
                    {age}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              Has your child taken dance classes before?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "none", label: "Never" },
                { value: "some", label: "A little" },
                { value: "yes", label: "Yes, 1+ years" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExperience(opt.value)}
                  className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                    experience === opt.value
                      ? "bg-lavender text-white border-lavender"
                      : "bg-white border-silver text-charcoal hover:border-lavender"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interest */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              What is your child most interested in?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { value: "ballet", label: "Ballet" },
                { value: "jazz", label: "Jazz" },
                { value: "contemporary", label: "Contemporary" },
                { value: "musical_theatre", label: "Musical Theatre" },
                { value: "not_sure", label: "Not sure yet" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setInterest(opt.value)}
                  className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                    interest === opt.value
                      ? "bg-lavender text-white border-lavender"
                      : "bg-white border-silver text-charcoal hover:border-lavender"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred day (optional) */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              Preferred day? <span className="text-mist">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setPreferredDay(preferredDay === d ? null : d)
                  }
                  className={`h-10 rounded-lg border px-4 text-sm font-medium transition-colors ${
                    preferredDay === d
                      ? "bg-lavender text-white border-lavender"
                      : "bg-white border-silver text-charcoal hover:border-lavender"
                  }`}
                >
                  {DAYS[d].slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleQuizSubmit}
            disabled={childAge === null || !experience}
            className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-40"
          >
            Find My Classes
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setRecommendedClasses(classes);
                setStep("results");
              }}
              className="text-sm text-lavender hover:text-lavender-dark font-medium"
            >
              Or browse all classes
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Results ───────────────────────── */}
      {step === "results" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              {recommendedClasses.length > 0
                ? "Recommended for your child"
                : "No exact match found"}
            </h2>
            <p className="mt-1 text-sm text-slate">
              {recommendedClasses.length > 0
                ? "Based on your answers, here are the best options."
                : "We didn't find an exact match, but here are some alternatives."}
            </p>
          </div>

          {recommendedClasses.length === 0 && (
            <div className="rounded-xl border border-silver bg-white p-6 text-center">
              <p className="text-sm text-slate mb-4">
                We don&apos;t currently have a class matching your criteria, but
                we&apos;d love to hear from you.
              </p>
              <p className="text-sm text-charcoal font-medium">
                Call us at (949) 229-0846 or email dance@bamsocal.com
              </p>
            </div>
          )}

          <div className="space-y-4">
            {recommendedClasses.map((cls) => (
              <div
                key={cls.id}
                className="rounded-xl border border-silver bg-white p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-charcoal">
                      {cls.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs bg-lavender/10 text-lavender-dark px-2 py-0.5 rounded-full font-medium">
                        {STYLE_LABELS[cls.style] ?? cls.style}
                      </span>
                      <span className="text-xs text-mist capitalize">
                        {cls.level}
                      </span>
                      {cls.ageMin && (
                        <span className="text-xs text-mist">
                          Ages {cls.ageMin}–{cls.ageMax ?? "up"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {cls.isFull ? (
                      <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded-full font-medium">
                        Waitlist
                      </span>
                    ) : (
                      <span className="text-xs text-success font-medium">
                        {cls.spotsRemaining} spot
                        {cls.spotsRemaining !== 1 ? "s" : ""} left
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate">
                  <span>
                    {DAYS[cls.dayOfWeek]}s · {formatTime(cls.startTime)}–
                    {formatTime(cls.endTime)}
                  </span>
                  {cls.room && <span>Room: {cls.room}</span>}
                  {cls.teacherName && <span>{cls.teacherName}</span>}
                </div>

                {cls.description && (
                  <p className="text-sm text-slate leading-relaxed">
                    {cls.description}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => selectClass(cls)}
                    className="flex-1 h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors"
                  >
                    {cls.isFull ? "Join Waitlist" : "Enroll in This Class"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClass(cls);
                      setShowTrial(true);
                    }}
                    className="h-11 rounded-lg border border-silver text-slate hover:text-charcoal hover:border-lavender font-medium text-sm px-5 transition-colors"
                  >
                    Free Trial
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep("quiz")}
            className="text-sm text-lavender hover:text-lavender-dark font-medium"
          >
            &larr; Back to quiz
          </button>
        </div>
      )}

      {/* ─── Trial Booking Modal ───────────────────── */}
      {showTrial && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-heading text-lg font-semibold text-charcoal">
              Book a Free Trial
            </h3>
            <p className="text-sm text-slate">
              Try <strong>{selectedClass.name}</strong> with no commitment.
            </p>

            {trialResult ? (
              <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
                {trialResult}
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Child's name"
                  value={trialChildName}
                  onChange={(e) => setTrialChildName(e.target.value)}
                  className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="Your email address"
                  value={trialEmail}
                  onChange={(e) => setTrialEmail(e.target.value)}
                  className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleBookTrial}
                  disabled={!trialChildName || !trialEmail || loading}
                  className="w-full h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-40"
                >
                  {loading ? "Booking..." : "Book Trial Class"}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowTrial(false);
                setTrialResult("");
                setTrialChildName("");
                setTrialEmail("");
              }}
              className="text-sm text-mist hover:text-charcoal font-medium"
            >
              {trialResult ? "Done" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Auth ──────────────────────────── */}
      {step === "auth" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              {authMode === "signup"
                ? "Create your account"
                : "Sign in to continue"}
            </h2>
            <p className="mt-1 text-sm text-slate">
              {authMode === "signup"
                ? "Quick setup — we just need the basics."
                : "Welcome back! Sign in to enroll."}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAuth(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            {authMode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="firstName"
                    type="text"
                    required
                    placeholder="First name"
                    autoComplete="given-name"
                    className="h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
                  />
                  <input
                    name="lastName"
                    type="text"
                    required
                    placeholder="Last name"
                    autoComplete="family-name"
                    className="h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
                  />
                </div>
                <input
                  name="phone"
                  type="tel"
                  placeholder="Phone number (optional)"
                  autoComplete="tel"
                  className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
                />
              </>
            )}

            <input
              name="email"
              type="email"
              required
              placeholder="Email address"
              autoComplete="email"
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder={
                authMode === "signup"
                  ? "Create a password (8+ chars)"
                  : "Password"
              }
              autoComplete={
                authMode === "signup" ? "new-password" : "current-password"
              }
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />

            {authMode === "signup" && (
              <select
                name="referralSource"
                className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-slate focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              >
                <option value="">How did you hear about us?</option>
                <option value="google">Google search</option>
                <option value="instagram">Instagram</option>
                <option value="friend">Friend referral</option>
                <option value="performance">Saw a performance</option>
                <option value="yelp">Yelp</option>
                <option value="other">Other</option>
              </select>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-40"
            >
              {loading
                ? "Please wait..."
                : authMode === "signup"
                  ? "Create Account & Continue"
                  : "Sign In & Continue"}
            </button>
          </form>

          <p className="text-center text-sm text-mist">
            {authMode === "signup"
              ? "Already have an account? "
              : "New to our studio? "}
            <button
              type="button"
              onClick={() =>
                setAuthMode(authMode === "signup" ? "signin" : "signup")
              }
              className="text-lavender font-medium hover:text-lavender-dark"
            >
              {authMode === "signup" ? "Sign in" : "Create account"}
            </button>
          </p>

          <button
            type="button"
            onClick={() => setStep("results")}
            className="text-sm text-lavender hover:text-lavender-dark font-medium"
          >
            &larr; Back to classes
          </button>
        </div>
      )}

      {/* ─── Step 4: Student Profile ───────────────── */}
      {step === "student" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              Who are we enrolling?
            </h2>
            <p className="mt-1 text-sm text-slate">
              Select an existing dancer or add a new one.
            </p>
          </div>

          {/* Existing students */}
          {existingStudents.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-charcoal">
                Your dancers
              </p>
              {existingStudents.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectExistingStudent(s.id)}
                  className="w-full flex items-center gap-3 rounded-xl border border-silver bg-white p-4 hover:border-lavender transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-lavender/10 flex items-center justify-center text-sm font-semibold text-lavender">
                    {s.first_name[0]}
                    {s.last_name[0]}
                  </div>
                  <span className="text-sm font-medium text-charcoal">
                    {s.first_name} {s.last_name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Add new student */}
          <div className="space-y-3">
            {existingStudents.length > 0 && (
              <p className="text-sm font-medium text-charcoal">
                Or add a new dancer
              </p>
            )}
            <input
              type="text"
              placeholder="Child's full name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
            <div>
              <label className="block text-xs text-mist mb-1">
                Date of birth
              </label>
              <input
                type="date"
                value={studentDob}
                onChange={(e) => setStudentDob(e.target.value)}
                className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              />
            </div>
            <textarea
              placeholder="Any health or physical considerations? (optional)"
              value={medicalNotes}
              onChange={(e) => setMedicalNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-silver bg-white px-4 py-3 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-none"
            />
            <button
              type="button"
              onClick={handleAddStudent}
              disabled={!studentName.trim() || !studentDob || loading}
              className="w-full h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-40"
            >
              {loading ? "Adding..." : "Add Dancer & Continue"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setStep("results")}
            className="text-sm text-lavender hover:text-lavender-dark font-medium"
          >
            &larr; Back to classes
          </button>
        </div>
      )}

      {/* ─── Step 5: Confirm ───────────────────────── */}
      {step === "confirm" && selectedClass && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              Confirm Enrollment
            </h2>
          </div>

          <div className="rounded-xl border border-silver bg-white p-6 space-y-4">
            <h3 className="font-heading text-lg font-semibold text-charcoal">
              {selectedClass.name}
            </h3>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <p className="text-mist text-xs">Style & Level</p>
                <p className="text-charcoal font-medium capitalize">
                  {STYLE_LABELS[selectedClass.style] ?? selectedClass.style} ·{" "}
                  {selectedClass.level}
                </p>
              </div>
              <div>
                <p className="text-mist text-xs">Schedule</p>
                <p className="text-charcoal font-medium">
                  {DAYS[selectedClass.dayOfWeek]}s ·{" "}
                  {formatTime(selectedClass.startTime)}
                </p>
              </div>
              {selectedClass.teacherName && (
                <div>
                  <p className="text-mist text-xs">Instructor</p>
                  <p className="text-charcoal font-medium">
                    {selectedClass.teacherName}
                  </p>
                </div>
              )}
              {selectedClass.room && (
                <div>
                  <p className="text-mist text-xs">Room</p>
                  <p className="text-charcoal font-medium">
                    {selectedClass.room}
                  </p>
                </div>
              )}
              <div>
                <p className="text-mist text-xs">Availability</p>
                <p className="text-charcoal font-medium">
                  {selectedClass.isFull ? (
                    <span className="text-warning">
                      Full — joining waitlist
                    </span>
                  ) : (
                    <span className="text-success">
                      {selectedClass.spotsRemaining} spot
                      {selectedClass.spotsRemaining !== 1 ? "s" : ""} available
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="border-t border-silver pt-4 space-y-2">
              <h4 className="text-sm font-medium text-charcoal">
                What to bring to the first class
              </h4>
              <ul className="text-sm text-slate space-y-1">
                <li>
                  · Ballet shoes (pink for girls, black or white for boys)
                </li>
                <li>· Leotard and tights (solid colors preferred)</li>
                <li>· Hair pulled back in a neat bun</li>
                <li>· Water bottle</li>
              </ul>
            </div>

            <div className="border-t border-silver pt-4">
              <p className="text-xs text-mist">
                <strong>Studio address:</strong> 400-C Camino De Estrella, San
                Clemente, CA 92672
              </p>
              <p className="text-xs text-mist mt-1">
                <strong>Cancellation:</strong> Classes may be dropped at any
                time. Refunds issued for unused sessions on a prorated basis.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnroll}
            disabled={loading}
            className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-40"
          >
            {loading
              ? "Enrolling..."
              : selectedClass.isFull
                ? "Join Waitlist"
                : "Confirm Enrollment"}
          </button>

          <button
            type="button"
            onClick={() => setStep("student")}
            className="text-sm text-lavender hover:text-lavender-dark font-medium"
          >
            &larr; Back
          </button>
        </div>
      )}

      {/* ─── Step 6: Done ──────────────────────────── */}
      {step === "done" && enrollResult && (
        <div className="space-y-6 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-success"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>

          <h2 className="font-heading text-2xl font-semibold text-charcoal">
            {enrollResult.status === "active"
              ? "You're enrolled!"
              : "Added to waitlist"}
          </h2>
          <p className="text-sm text-slate max-w-md mx-auto">
            {enrollResult.status === "active"
              ? `Your child is now enrolled in ${enrollResult.className}. We'll send a confirmation email with all the details.`
              : `${enrollResult.className} is currently full. We've added you to the waitlist and will notify you as soon as a spot opens.`}
          </p>

          {enrollResult.ageWarning && (
            <div className="rounded-lg bg-warning/10 border border-warning/20 px-4 py-3 text-sm text-warning max-w-md mx-auto">
              {enrollResult.ageWarning}
            </div>
          )}

          <div className="flex flex-col items-center gap-3 pt-2">
            <a
              href="/portal/dashboard"
              className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-8 flex items-center transition-colors"
            >
              Go to My Portal
            </a>
            <button
              type="button"
              onClick={() => {
                setStep("results");
                setSelectedClass(null);
                setStudentId(null);
                setEnrollResult(null);
              }}
              className="text-sm text-lavender hover:text-lavender-dark font-medium"
            >
              Enroll in another class
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
