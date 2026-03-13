import Image from "next/image";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-cream">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center">
          <Image
            src="/images/studio-logo.png"
            alt="Ballet Academy and Movement"
            width={80}
            height={80}
            className="mx-auto mb-4"
          />
          <h1 className="text-3xl font-heading font-semibold text-charcoal">
            Join Our Studio
          </h1>
          <p className="mt-2 text-sm text-slate">
            Create your Ballet Academy and Movement account
          </p>
        </div>

        {/* Signup form */}
        <SignupForm />

        {/* Login link */}
        <p className="text-center text-sm text-slate">
          Already have an account?{" "}
          <a
            href="/login"
            className="font-semibold text-lavender hover:text-lavender-dark"
          >
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
