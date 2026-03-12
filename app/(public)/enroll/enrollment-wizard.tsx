"use client";

import { useState } from "react";
import { enrollStudent, bookTrialClass } from "./actions";
import { useCart } from "@/lib/cart-context";

// ─── Types ──────────────────────────────────────────────

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
  monthlyTuitionCents: number | null;
  registrationFeeCents: number | null;
}

interface ChildData {
  name: string;
  age: number | null;
  experience: string;
  disciplines: string[];
}

interface RecommendationGroup {
  label: string;
  classes: ClassInfo[];
  pilatesGyroInterest: boolean;
}

type EnrolleeType = "myself" | "child" | "multiple";

type Step =
  | "who"
  | "adult_experience"
  | "adult_interests"
  | "adult_days"
  | "child_name"
  | "child_age"
  | "child_experience"
  | "child_disciplines"
  | "child_days"
  | "multi_child"
  | "results"
  | "auth"
  | "student"
  | "confirm"
  | "done";

// ─── Constants ──────────────────────────────────────────

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const STYLE_LABELS: Record<string, string> = {
  ballet: "Ballet",
  pre_ballet: "Pre-Ballet",
  creative_movement: "Creative Movement",
  pointe: "Pointe",
  jazz: "Jazz",
  contemporary: "Contemporary",
  lyrical: "Lyrical",
  musical_theatre: "Musical Theatre",
  hip_hop: "Hip Hop",
};

const ADULT_EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Complete beginner", desc: "Never taken a formal class" },
  { value: "some", label: "Some experience", desc: "Took classes years ago or casually" },
  { value: "intermediate", label: "Intermediate", desc: "Fairly consistent training" },
  { value: "advanced", label: "Advanced", desc: "Serious training background" },
];

const ADULT_INTEREST_OPTIONS = [
  { value: "ballet", label: "Ballet" },
  { value: "jazz", label: "Jazz" },
  { value: "contemporary", label: "Contemporary" },
  { value: "hip_hop", label: "Hip Hop" },
  { value: "pilates", label: "Pilates (mat or reformer)" },
  { value: "gyrotonic", label: "Gyrotonic" },
  { value: "not_sure", label: "Not sure — help me decide" },
];

const CHILD_EXPERIENCE_OPTIONS = [
  { value: "never", label: "Never", desc: "This will be their first class" },
  { value: "a_little", label: "A little", desc: "Some classes but nothing formal" },
  { value: "yes_other", label: "Yes, at another studio", desc: "We'd like to find the right level" },
  { value: "yes_bam", label: "Yes, here at Ballet Academy and Movement", desc: "Returning student" },
];

const QUIZ_STEPS: Record<EnrolleeType, Step[]> = {
  myself: ["who", "adult_experience", "adult_interests", "adult_days", "results"],
  child: ["who", "child_name", "child_age", "child_experience", "child_disciplines", "child_days", "results"],
  multiple: ["who", "multi_child", "results"],
};

// ─── Helpers ────────────────────────────────────────────

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function getDisciplinesForAge(age: number | null) {
  const opts: { value: string; label: string }[] = [
    { value: "ballet", label: "Ballet" },
  ];
  if (age === null || age >= 6) opts.push({ value: "jazz", label: "Jazz" });
  if (age === null || age >= 8) opts.push({ value: "contemporary", label: "Contemporary" });
  if (age === null || age >= 10) {
    opts.push({ value: "lyrical", label: "Lyrical" });
    opts.push({ value: "musical_theatre", label: "Musical Theatre" });
  }
  if (age === null || age >= 10) opts.push({ value: "hip_hop", label: "Hip Hop" });
  opts.push({ value: "not_sure", label: "Not sure yet" });
  return opts;
}

function getChildRecommendations(
  label: string,
  age: number | null,
  experience: string,
  disciplines: string[],
  days: number[],
  classes: ClassInfo[]
): RecommendationGroup {
  let matches = classes.filter((cls) => {
    if (age === null) return true;
    if (cls.ageMin !== null && age < cls.ageMin - 1) return false;
    if (cls.ageMax !== null && age > cls.ageMax + 1) return false;
    return true;
  });

  const realDisciplines = disciplines.filter((d) => d !== "not_sure");
  if (realDisciplines.length > 0) {
    const styleMap: Record<string, string[]> = {
      ballet: ["ballet", "pre_ballet", "creative_movement"],
      jazz: ["jazz"],
      contemporary: ["contemporary", "lyrical"],
      lyrical: ["lyrical", "contemporary"],
      musical_theatre: ["musical_theatre"],
      hip_hop: ["hip_hop"],
    };
    const targetStyles = realDisciplines.flatMap((d) => styleMap[d] ?? [d]);
    const filtered = matches.filter((c) => targetStyles.includes(c.style));
    if (filtered.length > 0) matches = filtered;
  }

  if (days.length > 0) {
    const dayFiltered = matches.filter((c) => days.includes(c.dayOfWeek));
    if (dayFiltered.length > 0) matches = dayFiltered;
  }

  const experienced = experience === "yes_other" || experience === "yes_bam";
  const levelPriority = experienced
    ? ["intermediate", "advanced", "beginner", "open"]
    : ["petite", "beginner", "open", "intermediate"];

  matches.sort((a, b) => {
    const aIdx = levelPriority.indexOf(a.level);
    const bIdx = levelPriority.indexOf(b.level);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  return { label: `For ${label}`, classes: matches.slice(0, 3), pilatesGyroInterest: false };
}

function getAdultRecommendations(
  experience: string,
  interests: string[],
  days: number[],
  classes: ClassInfo[]
): RecommendationGroup {
  const hasPilatesGyro = interests.some(
    (i) => i === "pilates" || i === "gyrotonic"
  );
  const danceInterests = interests.filter(
    (i) => !["pilates", "gyrotonic", "not_sure"].includes(i)
  );

  // Only return adult/teen classes: level "open" with age_min >= 14
  // This excludes children's classes (petite, beginner, intermediate, etc.)
  // and kids open-level classes like Pop-Up Hip Hop (age_min=5)
  let matches = classes.filter((cls) => {
    return cls.level === "open" && cls.ageMin !== null && cls.ageMin >= 14;
  });

  // When only pilates/gyrotonic selected, return zero dance classes
  if (danceInterests.length > 0) {
    const styleMap: Record<string, string[]> = {
      ballet: ["ballet"],
      jazz: ["jazz"],
      contemporary: ["contemporary", "lyrical"],
      hip_hop: ["hip_hop"],
    };
    const targetStyles = danceInterests.flatMap((i) => styleMap[i] ?? []);
    const filtered = matches.filter((c) => targetStyles.includes(c.style));
    if (filtered.length > 0) matches = filtered;
  } else {
    // No dance interests — only pilates/gyrotonic or not_sure — show no classes
    matches = [];
  }

  if (days.length > 0) {
    const dayFiltered = matches.filter((c) => days.includes(c.dayOfWeek));
    if (dayFiltered.length > 0) matches = dayFiltered;
  }

  const isExperienced = experience === "intermediate" || experience === "advanced";
  const levelPriority = isExperienced
    ? ["intermediate", "advanced", "open", "beginner"]
    : ["beginner", "open", "intermediate"];

  matches.sort((a, b) => {
    const aIdx = levelPriority.indexOf(a.level);
    const bIdx = levelPriority.indexOf(b.level);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  return {
    label: "For you",
    classes: matches.slice(0, 3),
    pilatesGyroInterest: hasPilatesGyro,
  };
}

function toggleMulti<T>(value: T, current: T[], exclusive?: T): T[] {
  if (value === exclusive) {
    return current.includes(value) ? [] : [value];
  }
  const without = exclusive !== undefined ? current.filter((v) => v !== exclusive) : current;
  return without.includes(value)
    ? without.filter((v) => v !== value)
    : [...without, value];
}

// ─── Component ──────────────────────────────────────────

export function EnrollmentWizard({ classes }: { classes: ClassInfo[] }) {
  const cart = useCart();

  // ─── Quiz state ─────────────────────────────────
  const [step, setStep] = useState<Step>("who");
  const [enrolleeType, setEnrolleeType] = useState<EnrolleeType | null>(null);

  // Adult branch
  const [adultExperience, setAdultExperience] = useState("");
  const [adultInterests, setAdultInterests] = useState<string[]>([]);
  const [adultDays, setAdultDays] = useState<number[]>([]);

  // Single child branch
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState<number | null>(null);
  const [childExperience, setChildExperience] = useState("");
  const [childDisciplines, setChildDisciplines] = useState<string[]>([]);
  const [childDays, setChildDays] = useState<number[]>([]);

  // Multi-child branch
  const [children, setChildren] = useState<ChildData[]>([]);
  const [mcName, setMcName] = useState("");
  const [mcAge, setMcAge] = useState<number | null>(null);
  const [mcExperience, setMcExperience] = useState("");
  const [mcDisciplines, setMcDisciplines] = useState<string[]>([]);

  // ─── Results state ──────────────────────────────
  const [recommendations, setRecommendations] = useState<RecommendationGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);

  // ─── Enrollment state ───────────────────────────
  const [studentName, setStudentName] = useState("");
  const [studentDob, setStudentDob] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [existingStudents, setExistingStudents] = useState<
    { id: string; first_name: string; last_name: string }[]
  >([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
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

  // ─── Navigation ─────────────────────────────────
  const BACK_MAP: Partial<Record<Step, Step>> = {
    adult_experience: "who",
    adult_interests: "adult_experience",
    adult_days: "adult_interests",
    child_name: "who",
    child_age: "child_name",
    child_experience: "child_age",
    child_disciplines: "child_experience",
    child_days: "child_disciplines",
    multi_child: "who",
    results:
      enrolleeType === "myself"
        ? "adult_days"
        : enrolleeType === "child"
          ? "child_days"
          : "multi_child",
    auth: "results",
    student: "results",
    confirm: "student",
  };

  function goBack() {
    const prev = BACK_MAP[step];
    if (prev) {
      setError("");
      setStep(prev);
    }
  }

  // ─── Progress ───────────────────────────────────
  function getProgress() {
    if (!enrolleeType) return { current: 0, total: 1 };
    const steps = QUIZ_STEPS[enrolleeType];
    const idx = steps.indexOf(step);
    if (idx >= 0) return { current: idx, total: steps.length };
    return { current: steps.length - 1, total: steps.length };
  }

  // ─── Compute recommendations ────────────────────
  function computeAndShowResults() {
    let groups: RecommendationGroup[];

    if (enrolleeType === "myself") {
      groups = [getAdultRecommendations(adultExperience, adultInterests, adultDays, classes)];
    } else if (enrolleeType === "child") {
      groups = [
        getChildRecommendations(
          childName || "your child",
          childAge,
          childExperience,
          childDisciplines,
          childDays,
          classes
        ),
      ];
    } else {
      groups = children.map((child) =>
        getChildRecommendations(
          child.name,
          child.age,
          child.experience,
          child.disciplines,
          [],
          classes
        )
      );
    }

    setRecommendations(groups);
    setStep("results");
  }

  // ─── Multi-child add ────────────────────────────
  function addChild() {
    if (!mcName.trim() || mcAge === null || !mcExperience) return;
    setChildren([
      ...children,
      { name: mcName.trim(), age: mcAge, experience: mcExperience, disciplines: [...mcDisciplines] },
    ]);
    setMcName("");
    setMcAge(null);
    setMcExperience("");
    setMcDisciplines([]);
  }

  function removeChild(idx: number) {
    setChildren(children.filter((_, i) => i !== idx));
  }

  // ─── Enrollment handlers (unchanged) ────────────
  function selectClass(cls: ClassInfo, prefilledName?: string) {
    setSelectedClass(cls);
    if (prefilledName) setStudentName(prefilledName);
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

  async function handleAuth(formData: FormData) {
    setLoading(true);
    setError("");

    if (authMode === "signup") {
      const password = formData.get("password") as string;
      const confirmPassword = formData.get("confirmPassword") as string;
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
    }

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

  async function handleBookTrial() {
    if (!trialChildName || !trialEmail || !selectedClass) return;
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("childName", trialChildName);
    fd.set("childAge", String(childAge ?? 5));
    fd.set("email", trialEmail);
    fd.set("classId", selectedClass.id);
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

  // ─── Shared UI helpers ──────────────────────────
  const btnSelected =
    "bg-lavender text-white border-lavender";
  const btnDefault =
    "bg-white border-silver text-charcoal hover:border-lavender";

  function optCls(selected: boolean) {
    return `rounded-lg border text-sm font-medium transition-colors ${selected ? btnSelected : btnDefault}`;
  }

  // ─── Render ─────────────────────────────────────
  const { current: progCurrent, total: progTotal } = getProgress();
  const isQuizStep = enrolleeType
    ? QUIZ_STEPS[enrolleeType].includes(step)
    : step === "who";
  const displayName = childName || "your child";

  return (
    <div className="space-y-6">
      {/* Progress dots (quiz phase only) */}
      {isQuizStep && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: progTotal }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-10 rounded-full transition-colors ${
                i <= progCurrent ? "bg-lavender" : "bg-silver"
              }`}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* ─── Step: Who ───────────────────────────── */}
      {step === "who" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              Who are you looking to enroll?
            </h2>
            <p className="mt-2 text-sm text-slate">
              We&apos;ll recommend the best classes based on your answers.
            </p>
          </div>

          <div className="space-y-3">
            {([
              {
                type: "myself" as EnrolleeType,
                icon: "\uD83E\uDE70",
                title: "Myself",
                desc: "I want to take classes",
              },
              {
                type: "child" as EnrolleeType,
                icon: "\uD83D\uDC67",
                title: "My child",
                desc: "I\u2019m enrolling my son or daughter",
              },
              {
                type: "multiple" as EnrolleeType,
                icon: "\uD83D\uDC68\u200D\uD83D\uDC67\u200D\uD83D\uDC66",
                title: "Multiple children",
                desc: "I have more than one child to enroll",
              },
            ]).map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => {
                  setEnrolleeType(opt.type);
                  setStep(
                    opt.type === "myself"
                      ? "adult_experience"
                      : opt.type === "child"
                        ? "child_name"
                        : "multi_child"
                  );
                }}
                className="w-full flex items-center gap-4 rounded-xl border-2 border-silver bg-white p-5 hover:border-lavender transition-colors text-left"
              >
                <span className="text-3xl">{opt.icon}</span>
                <div>
                  <p className="font-heading text-base font-semibold text-charcoal">
                    {opt.title}
                  </p>
                  <p className="text-sm text-slate">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setRecommendations([
                  { label: "All classes", classes, pilatesGyroInterest: false },
                ]);
                setEnrolleeType("child");
                setStep("results");
              }}
              className="text-sm text-lavender hover:text-lavender-dark font-medium"
            >
              Or browse all classes
            </button>
          </div>
        </div>
      )}

      {/* ─── Adult: Experience ────────────────────── */}
      {step === "adult_experience" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              How would you describe your dance experience?
            </h2>
          </div>

          <div className="space-y-3">
            {ADULT_EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setAdultExperience(opt.value);
                  setStep("adult_interests");
                }}
                className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                  adultExperience === opt.value
                    ? "border-lavender bg-lavender/5"
                    : "border-silver bg-white hover:border-lavender"
                }`}
              >
                <p className="text-sm font-semibold text-charcoal">{opt.label}</p>
                <p className="text-xs text-slate mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          <BackButton onClick={goBack} />
        </div>
      )}

      {/* ─── Adult: Interests ────────────────────── */}
      {step === "adult_interests" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              What are you most interested in?
            </h2>
            <p className="mt-1 text-sm text-slate">Select all that apply</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ADULT_INTEREST_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setAdultInterests(
                    toggleMulti(opt.value, adultInterests, "not_sure")
                  )
                }
                className={`h-12 px-3 ${optCls(adultInterests.includes(opt.value))}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep("adult_days")}
            disabled={adultInterests.length === 0}
            className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-40"
          >
            Next
          </button>
          <BackButton onClick={goBack} />
        </div>
      )}

      {/* ─── Adult: Days ─────────────────────────── */}
      {step === "adult_days" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              What days work best for you?
            </h2>
            <p className="mt-1 text-sm text-slate">Select all that apply</p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setAdultDays(toggleMulti(d, adultDays))}
                className={`h-11 px-5 ${optCls(adultDays.includes(d))}`}
              >
                {DAYS[d]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={computeAndShowResults}
            className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors"
          >
            Find My Classes
          </button>
          <BackButton onClick={goBack} />
        </div>
      )}

      {/* ─── Child: Name ─────────────────────────── */}
      {step === "child_name" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              What&apos;s your child&apos;s first name?
            </h2>
            <p className="mt-1 text-sm text-slate">
              We&apos;ll use this to personalize recommendations
            </p>
          </div>

          <input
            type="text"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="First name"
            autoFocus
            className="w-full h-12 rounded-lg border border-silver bg-white px-4 text-base text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && childName.trim()) setStep("child_age");
            }}
          />

          <button
            type="button"
            onClick={() => setStep("child_age")}
            disabled={!childName.trim()}
            className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-40"
          >
            Next
          </button>
          <BackButton onClick={goBack} />
        </div>
      )}

      {/* ─── Child: Age ──────────────────────────── */}
      {step === "child_age" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              How old is {displayName}?
            </h2>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(
              (age) => (
                <button
                  key={age}
                  type="button"
                  onClick={() => {
                    setChildAge(age);
                    setStep("child_experience");
                  }}
                  className={`h-10 w-12 ${optCls(childAge === age)}`}
                >
                  {age}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => {
                setChildAge(18);
                setStep("child_experience");
              }}
              className={`h-10 px-4 ${optCls(childAge === 18)}`}
            >
              18+
            </button>
          </div>

          <BackButton onClick={goBack} />
        </div>
      )}

      {/* ─── Child: Experience ───────────────────── */}
      {step === "child_experience" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              Has {displayName} danced before?
            </h2>
          </div>

          <div className="space-y-3">
            {CHILD_EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setChildExperience(opt.value);
                  setStep("child_disciplines");
                }}
                className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                  childExperience === opt.value
                    ? "border-lavender bg-lavender/5"
                    : "border-silver bg-white hover:border-lavender"
                }`}
              >
                <p className="text-sm font-semibold text-charcoal">{opt.label}</p>
                <p className="text-xs text-slate mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          <BackButton onClick={goBack} />
        </div>
      )}

      {/* ─── Child: Disciplines ──────────────────── */}
      {step === "child_disciplines" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              What disciplines interest {displayName}?
            </h2>
            <p className="mt-1 text-sm text-slate">Select all that apply</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {getDisciplinesForAge(childAge).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setChildDisciplines(
                    toggleMulti(opt.value, childDisciplines, "not_sure")
                  )
                }
                className={`h-12 px-3 ${optCls(childDisciplines.includes(opt.value))}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep("child_days")}
            disabled={childDisciplines.length === 0}
            className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-40"
          >
            Next
          </button>
          <BackButton onClick={goBack} />
        </div>
      )}

      {/* ─── Child: Days ─────────────────────────── */}
      {step === "child_days" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              What days work best?
            </h2>
            <p className="mt-1 text-sm text-slate">Select all that apply</p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setChildDays(toggleMulti(d, childDays))}
                className={`h-11 px-5 ${optCls(childDays.includes(d))}`}
              >
                {DAYS[d]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={computeAndShowResults}
            className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors"
          >
            Find Classes for {displayName}
          </button>
          <BackButton onClick={goBack} />
        </div>
      )}

      {/* ─── Multi-child ─────────────────────────── */}
      {step === "multi_child" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              Tell us about your children
            </h2>
            <p className="mt-1 text-sm text-slate">
              We&apos;ll recommend the best classes for each child
            </p>
          </div>

          {/* Added children */}
          {children.length > 0 && (
            <div className="space-y-2">
              {children.map((child, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-silver bg-white px-4 py-3"
                >
                  <div className="text-sm">
                    <span className="font-medium text-charcoal">
                      {child.name}
                    </span>
                    <span className="text-slate ml-2">
                      age {child.age}
                      {child.age === 18 ? "+" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeChild(idx)}
                    className="text-mist hover:text-error text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add child form */}
          {children.length < 4 ? (
            <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
              <p className="text-sm font-medium text-charcoal">
                {children.length === 0
                  ? "First child"
                  : `Child ${children.length + 1}`}
              </p>

              <input
                type="text"
                value={mcName}
                onChange={(e) => setMcName(e.target.value)}
                placeholder="First name"
                className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              />

              <div>
                <label className="block text-xs text-mist mb-1.5">Age</label>
                <div className="flex flex-wrap gap-1.5">
                  {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(
                    (age) => (
                      <button
                        key={age}
                        type="button"
                        onClick={() => setMcAge(age)}
                        className={`h-8 w-10 text-xs ${optCls(mcAge === age)}`}
                      >
                        {age}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setMcAge(18)}
                    className={`h-8 px-2.5 text-xs ${optCls(mcAge === 18)}`}
                  >
                    18+
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-mist mb-1.5">
                  Dance experience
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHILD_EXPERIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMcExperience(opt.value)}
                      className={`h-9 px-2 text-xs ${optCls(mcExperience === opt.value)}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-mist mb-1.5">
                  Disciplines
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {getDisciplinesForAge(mcAge).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setMcDisciplines(
                          toggleMulti(opt.value, mcDisciplines, "not_sure")
                        )
                      }
                      className={`h-9 px-3 text-xs ${optCls(mcDisciplines.includes(opt.value))}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={addChild}
                disabled={!mcName.trim() || mcAge === null || !mcExperience}
                className="w-full h-10 rounded-lg border-2 border-lavender text-lavender hover:bg-lavender/5 font-semibold text-sm transition-colors disabled:opacity-40 disabled:border-silver disabled:text-mist"
              >
                + Add Child
              </button>
            </div>
          ) : (
            <div className="rounded-lg bg-lavender/5 border border-lavender/20 px-4 py-3 text-sm text-slate">
              For more than 4 children, please contact us directly at{" "}
              <strong>(949) 229-0846</strong> — we&apos;d love to help you find
              the right classes for everyone.
            </div>
          )}

          {children.length > 0 && (
            <button
              type="button"
              onClick={computeAndShowResults}
              className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors"
            >
              See Recommendations
            </button>
          )}

          <BackButton onClick={goBack} />
        </div>
      )}

      {/* ─── Results ─────────────────────────────── */}
      {step === "results" && (
        <div className="space-y-6">
          {recommendations.map((group, gi) => (
            <div key={gi} className="space-y-4">
              <div className="text-center">
                <h2 className="font-heading text-2xl font-semibold text-charcoal">
                  {recommendations.length === 1 && group.label === "For you"
                    ? "Recommended for you"
                    : recommendations.length === 1
                      ? `Recommended for ${group.label.replace("For ", "")}`
                      : group.label}
                </h2>
                {gi === 0 && (
                  <p className="mt-1 text-sm text-slate">
                    Based on your answers, here are the best options.
                  </p>
                )}
              </div>

              {/* Pilates / Gyrotonic card */}
              {group.pilatesGyroInterest && (
                <div className="rounded-xl border-2 border-gold/40 bg-gold/5 p-5 space-y-2">
                  <h3 className="font-heading text-base font-semibold text-charcoal">
                    Pilates &amp; Gyrotonic
                  </h3>
                  <p className="text-sm text-slate">
                    We offer Pilates and Gyrotonic by appointment. We&apos;ll
                    reach out within 24 hours to schedule a session that works
                    for you.
                  </p>
                  <p className="text-sm text-charcoal font-medium">
                    Or contact us now: (949) 229-0846 · dance@bamsocal.com
                  </p>
                </div>
              )}

              {group.classes.length === 0 && !group.pilatesGyroInterest && (
                <div className="rounded-xl border border-silver bg-white p-6 text-center">
                  <p className="text-sm text-slate mb-4">
                    We don&apos;t currently have a class matching your criteria,
                    but we&apos;d love to hear from you.
                  </p>
                  <p className="text-sm text-charcoal font-medium">
                    Call us at (949) 229-0846 or email dance@bamsocal.com
                  </p>
                </div>
              )}

              {group.classes.map((cls) => (
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
                            Ages {cls.ageMin}&ndash;{cls.ageMax ?? "up"}
                          </span>
                        )}
                        <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">
                          Free Trial
                        </span>
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
                      {DAYS[cls.dayOfWeek]}s &middot; {formatTime(cls.startTime)}
                      &ndash;{formatTime(cls.endTime)}
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
                    {cart.hasClass(cls.id) ? (
                      <button
                        type="button"
                        disabled
                        className="flex-1 h-11 rounded-lg bg-success/10 text-success font-semibold text-sm cursor-default"
                      >
                        Added to Cart
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const nameForCart =
                            enrolleeType === "myself"
                              ? "You"
                              : enrolleeType === "child"
                                ? childName || "Your child"
                                : group.label.replace("For ", "");
                          cart.addItem({
                            classInfo: cls,
                            childName: nameForCart,
                            childAge:
                              enrolleeType === "child" ? childAge : null,
                            type: cls.isFull ? "waitlist" : "enroll",
                          });
                        }}
                        className="flex-1 h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors"
                      >
                        {cls.isFull ? "Join Waitlist" : "Add to Cart"}
                      </button>
                    )}
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

              {gi < recommendations.length - 1 && (
                <hr className="border-silver" />
              )}
            </div>
          ))}

          <div className="text-center pt-2">
            <p className="text-sm text-slate">
              Not sure this is right?{" "}
              <a
                href="/"
                className="text-lavender font-medium hover:text-lavender-dark"
              >
                Chat with us
              </a>{" "}
              or call (949) 229-0846
            </p>
          </div>

          <BackButton onClick={goBack} />
        </div>
      )}

      {/* ─── Trial Booking Modal ─────────────────── */}
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
                  placeholder={
                    enrolleeType === "myself"
                      ? "Your name"
                      : "Child\u2019s name"
                  }
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

      {/* ─── Auth ────────────────────────────────── */}
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
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                placeholder="Confirm password"
                autoComplete="new-password"
                className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              />
            )}

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

            {authMode === "signin" && (
              <div className="flex justify-end">
                <a
                  href="/forgot-password"
                  className="text-xs text-lavender hover:text-lavender-dark font-medium"
                >
                  Forgot password?
                </a>
              </div>
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

          <BackButton onClick={goBack} label="Back to classes" />
        </div>
      )}

      {/* ─── Student Profile ─────────────────────── */}
      {step === "student" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-charcoal">
              {enrolleeType === "myself"
                ? "Add your info"
                : "Who are we enrolling?"}
            </h2>
            <p className="mt-1 text-sm text-slate">
              {enrolleeType === "myself"
                ? "We need a few details to get you started."
                : "Select an existing dancer or add a new one."}
            </p>
          </div>

          {existingStudents.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-charcoal">
                {enrolleeType === "myself" ? "Your profiles" : "Your dancers"}
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

          <div className="space-y-3">
            {existingStudents.length > 0 && (
              <p className="text-sm font-medium text-charcoal">
                {enrolleeType === "myself"
                  ? "Or add a new profile"
                  : "Or add a new dancer"}
              </p>
            )}
            <input
              type="text"
              placeholder={
                enrolleeType === "myself" ? "Your full name" : "Child\u2019s full name"
              }
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
              {loading
                ? "Adding..."
                : enrolleeType === "myself"
                  ? "Continue"
                  : "Add Dancer & Continue"}
            </button>
          </div>

          <BackButton onClick={goBack} label="Back to classes" />
        </div>
      )}

      {/* ─── Confirm ─────────────────────────────── */}
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
                <p className="text-mist text-xs">Style &amp; Level</p>
                <p className="text-charcoal font-medium capitalize">
                  {STYLE_LABELS[selectedClass.style] ?? selectedClass.style}{" "}
                  &middot; {selectedClass.level}
                </p>
              </div>
              <div>
                <p className="text-mist text-xs">Schedule</p>
                <p className="text-charcoal font-medium">
                  {DAYS[selectedClass.dayOfWeek]}s &middot;{" "}
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
                      Full &mdash; joining waitlist
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
                  &middot; Ballet shoes (pink for girls, black or white for
                  boys)
                </li>
                <li>&middot; Leotard and tights (solid colors preferred)</li>
                <li>&middot; Hair pulled back in a neat bun</li>
                <li>&middot; Water bottle</li>
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

          <BackButton onClick={() => setStep("student")} />
        </div>
      )}

      {/* ─── Done ────────────────────────────────── */}
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
              ? "You\u2019re enrolled!"
              : "Added to waitlist"}
          </h2>
          <p className="text-sm text-slate max-w-md mx-auto">
            {enrollResult.status === "active"
              ? enrolleeType === "myself"
                ? `You are now enrolled in ${enrollResult.className}. We\u2019ll send a confirmation email with all the details.`
                : `Your child is now enrolled in ${enrollResult.className}. We\u2019ll send a confirmation email with all the details.`
              : `${enrollResult.className} is currently full. We\u2019ve added you to the waitlist and will notify you as soon as a spot opens.`}
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

// ─── Shared Components ──────────────────────────────────

function BackButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-lavender hover:text-lavender-dark font-medium"
    >
      &larr; {label ?? "Back"}
    </button>
  );
}
