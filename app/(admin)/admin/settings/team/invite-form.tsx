"use client";

import { useState } from "react";
import { inviteTeamMember } from "./actions";

const ROLE_OPTIONS = [
  { value: "teacher", label: "Teacher" },
  { value: "studio_admin", label: "Studio Admin" },
  { value: "finance_admin", label: "Finance Admin" },
  { value: "studio_manager", label: "Studio Manager" },
  { value: "admin", label: "Admin (full access)" },
];

export function InviteForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    setSuccess("");

    const result = await inviteTeamMember(formData);
    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess(`Invite sent to ${formData.get("email")}`);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
        Invite Team Member
      </h2>

      {error && (
        <div className="mb-3 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      <form action={handleSubmit} className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input
            name="firstName"
            type="text"
            required
            placeholder="First name"
            className="h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
          <input
            name="lastName"
            type="text"
            required
            placeholder="Last name"
            className="h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>
        <input
          name="email"
          type="email"
          required
          placeholder="Email address"
          className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
        />
        <select
          name="role"
          required
          className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
        >
          <option value="">Select role...</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Invite"}
        </button>
      </form>
    </section>
  );
}
