"use client";

import { useState } from "react";
import { signUp, signInWithGoogle } from "@/lib/auth/actions";

export function SignupForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(formData: FormData) {
    setLoading(true);
    setError("");
    setSuccess("");

    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const result = await signUp(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(
        "Account created! Check your email to confirm your address."
      );
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError("");
    const result = await signInWithGoogle();
    if (result?.error) {
      setLoading(false);
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      <form action={handleSignup} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              First name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              placeholder="First"
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              Last name
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              required
              placeholder="Last"
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Re-enter your password"
            className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-silver" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-cream px-3 text-mist">or</span>
        </div>
      </div>

      {/* Google OAuth */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full h-11 rounded-lg border-2 border-silver bg-white hover:bg-cloud text-charcoal font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      <p className="text-xs text-mist text-center">
        By creating an account, you agree to our terms of service and privacy
        policy.
      </p>
    </div>
  );
}
