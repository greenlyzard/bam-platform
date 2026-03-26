"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AssistantConfig } from "@/lib/assistant/config";

interface AccountCardProps {
  config: AssistantConfig;
  onComplete: (user: { id: string; firstName: string; email: string }) => void;
}

export function AccountCard({ config, onComplete }: AccountCardProps) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const supabase = createClient();

  const inputClass =
    "h-9 w-full rounded-lg border border-silver px-3 text-sm text-charcoal placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-opacity-20";

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.user) {
        onComplete({ id: data.user.id, firstName, email });
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      if (data.user) {
        const name =
          data.user.user_metadata?.first_name || email.split("@")[0];
        onComplete({ id: data.user.id, firstName: name, email });
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/enroll?step=2`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  if (mode === "login") {
    return (
      <div
        style={{ "--assistant-color": config.primaryColor } as React.CSSProperties}
        className="rounded-2xl border border-[var(--assistant-color)]/20 bg-white p-4 shadow-sm max-w-sm"
      >
        <p className="mb-3 text-sm font-medium text-charcoal">Welcome back!</p>
        {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
        <form onSubmit={handleLogin} className="flex flex-col gap-2">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: config.primaryColor }}
            className="h-9 w-full rounded-lg text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode("signup")}
          style={{ color: config.primaryColor }}
          className="mt-2 text-xs hover:underline"
        >
          Create a new account instead
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ "--assistant-color": config.primaryColor } as React.CSSProperties}
      className="rounded-2xl border border-[var(--assistant-color)]/20 bg-white p-4 shadow-sm max-w-sm"
    >
      <p className="mb-3 text-sm font-medium text-charcoal">
        Let&apos;s create your account
      </p>
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
      <form onSubmit={handleSignup} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ backgroundColor: config.primaryColor }}
          className="h-9 w-full rounded-lg text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>
      </form>

      <div className="my-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-silver" />
        <span className="text-xs text-mist">or</span>
        <div className="h-px flex-1 bg-silver" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="h-9 w-full rounded-lg border border-silver text-sm font-medium text-charcoal transition hover:bg-cream disabled:opacity-50"
      >
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => setMode("login")}
        style={{ color: config.primaryColor }}
        className="mt-2 text-xs hover:underline"
      >
        Already have an account?
      </button>
    </div>
  );
}
