import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-cream">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-heading font-semibold text-charcoal">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-slate">
            Sign in to Ballet Academy and Movement
          </p>
        </div>

        {/* Login form (client component) */}
        <LoginForm searchParams={searchParams} />

        {/* Sign up link */}
        <p className="text-center text-sm text-slate">
          New to the studio?{" "}
          <a
            href="/signup"
            className="font-semibold text-lavender hover:text-lavender-dark"
          >
            Create an account
          </a>
        </p>
      </div>
    </main>
  );
}
