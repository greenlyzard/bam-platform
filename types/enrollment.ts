// Types for the enrollment quiz + cart + checkout flow

export interface ClassInfo {
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
  /** Monthly tuition in cents */
  monthlyTuitionCents: number | null;
  /** Registration fee in cents */
  registrationFeeCents: number | null;
}

export interface CartItem {
  classInfo: ClassInfo;
  childName: string;
  childAge: number | null;
  /** "waitlist" if class is full */
  type: "enroll" | "waitlist" | "trial";
}

export interface ChildFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medicalNotes: string;
}

export interface CheckoutFormData {
  parentFirstName: string;
  parentLastName: string;
  email: string;
  phone: string;
  children: ChildFormData[];
}

export type EnrolleeType = "myself" | "child" | "multiple";

export type QuizStep =
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
  | "results";

export interface ChildData {
  name: string;
  age: number | null;
  experience: string;
  disciplines: string[];
}

export interface RecommendationGroup {
  label: string;
  classes: ClassInfo[];
  pilatesGyroInterest: boolean;
}
