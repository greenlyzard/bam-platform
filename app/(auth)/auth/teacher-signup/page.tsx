import { TeacherSignupForm } from "./teacher-signup-form";

export const metadata = {
  title: "Teacher Signup — Ballet Academy & Movement",
};

export default function TeacherSignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-semibold text-charcoal">
            Join Our Teaching Team
          </h1>
          <p className="mt-2 text-sm text-slate">
            Create your account to apply as an instructor at Ballet Academy &amp; Movement.
            Your account will be reviewed by our admin team.
          </p>
        </div>
        <TeacherSignupForm />
        <p className="mt-6 text-center text-xs text-mist">
          Already have an account?{" "}
          <a href="/login" className="text-lavender hover:text-lavender-dark font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
