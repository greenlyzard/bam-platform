"use client";

import { useState, use } from "react";
import {
  signInWithMagicLink,
  signInWithPassword,
  signInWithGoogle,
} from "@/lib/auth/actions";

type AuthMode = "magic_link" | "password";

export function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = use(searchParams);
  const [mode, setMode] = useState<AuthMode>("magic_link");
  const [error, setError] = useState(params.error ?? "");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleMagicLink(formData: FormData) {
    setLoading(true);
    setError("");
    setSuccess("");

    if (params.redirect) {
      formData.set("redirect", params.redirect);
    }

    const result = await signInWithMagicLink(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Check your email for a sign-in link.");
      setMagicLinkSent(true);
      setTimeout(() => setMagicLinkSent(false), 60_000);
    }
  }

  async function handlePassword(formData: FormData) {
    setLoading(true);
    setError("");

    const result = await signInWithPassword(formData);
    setLoading(false);

    if (result?.error) {
      setError(result.error);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError("");

    const formData = new FormData();
    if (params.redirect) {
      formData.set("redirect", params.redirect);
    }

    const result = await signInWithGoogle(formData);
    if (result?.error) {
      setLoading(false);
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error === "auth_callback_failed"
            ? "Sign in failed. Please try again."
            : error}
        </div>
      )}

      {/* Success message (magic link sent) */}
      {success && (
        <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-silver bg-cloud p-1">
        <button
          type="button"
          onClick={() => setMode("magic_link")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === "magic_link"
              ? "bg-white text-charcoal shadow-sm"
              : "text-slate hover:text-charcoal"
          }`}
        >
          Magic Link
        </button>
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === "password"
              ? "bg-white text-charcoal shadow-sm"
              : "text-slate hover:text-charcoal"
          }`}
        >
          Password
        </button>
      </div>

      {/* Magic link form */}
      {mode === "magic_link" && (
        <form action={handleMagicLink} className="space-y-4">
          <div>
            <label
              htmlFor="email-magic"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              Email address
            </label>
            <input
              id="email-magic"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || magicLinkSent}
            className="w-full h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending...
              </>
            ) : magicLinkSent ? (
              "Check your email \u2713"
            ) : (
              "Send Magic Link"
            )}
          </button>
        </form>
      )}

      {/* Password form */}
      {mode === "password" && (
        <form action={handlePassword} className="space-y-4">
          <div>
            <label
              htmlFor="email-password"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              Email address
            </label>
            <input
              id="email-password"
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
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-charcoal cursor-pointer">
              <input
                type="checkbox"
                name="remember"
                defaultChecked
                className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
              />
              Remember me
            </label>
            <a
              href="/forgot-password"
              className="text-xs text-lavender hover:text-lavender-dark font-medium"
            >
              Forgot password?
            </a>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      )}

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
    </div>
  );
}
