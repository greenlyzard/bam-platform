"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AcceptInviteInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<{ email: string; first_name: string; role: string } | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing invite link.");
      setLoadingInvite(false);
      return;
    }

    async function fetchInvite() {
      const res = await fetch(`/api/auth/accept-invite?token=${token}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setInvite(data.invite);
      }
      setLoadingInvite(false);
    }
    fetchInvite();
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const confirmPassword = form.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(true);
        // Redirect after short delay
        setTimeout(() => {
          window.location.href = data.redirectTo ?? "/login";
        }, 2000);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingInvite) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
        <p className="mt-4 text-sm text-slate">Loading invite...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-xl border border-success/20 bg-success/5 p-6 text-center space-y-3">
        <h2 className="font-heading text-xl font-semibold text-charcoal">
          Account Created!
        </h2>
        <p className="text-sm text-slate">
          Redirecting you to sign in...
        </p>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="rounded-xl border border-error/20 bg-error/5 p-6 text-center space-y-3">
        <h2 className="font-heading text-xl font-semibold text-charcoal">
          Invalid Invite
        </h2>
        <p className="text-sm text-slate">{error || "This invite link is invalid or has expired."}</p>
        <a href="/login" className="inline-block text-sm text-lavender hover:text-lavender-dark font-medium">
          Go to Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-lavender/5 border border-lavender/20 px-4 py-3 text-sm text-charcoal">
        Setting up account for <strong>{invite.email}</strong> as{" "}
        <strong>{invite.role.replace(/_/g, " ")}</strong>
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-charcoal mb-1.5">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-charcoal mb-1.5">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}

export function AcceptInviteForm() {
  return (
    <Suspense fallback={
      <div className="text-center py-8">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
      </div>
    }>
      <AcceptInviteInner />
    </Suspense>
  );
}
