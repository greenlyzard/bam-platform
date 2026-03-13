"use client";

import { useState } from "react";

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  role: string;
}

export function ProfileSettingsForm({ profile }: { profile: ProfileData }) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [preferredName, setPreferredName] = useState(profile.preferredName);
  const [phone, setPhone] = useState(profile.phone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [uploading, setUploading] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        preferred_name: preferredName,
        phone,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/profile/avatar", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const json = await res.json();
      setAvatarUrl(json.url);
    }
    setUploading(false);
  }

  async function handlePasswordChange() {
    if (newPassword.length < 8) {
      setPasswordMsg("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    setPasswordMsg("");

    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });

    setPasswordSaving(false);
    if (res.ok) {
      setPasswordMsg("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const json = await res.json();
      setPasswordMsg(json.error ?? "Failed to update password.");
    }
  }

  return (
    <div className="space-y-8">
      {/* Profile photo */}
      <div className="rounded-xl border border-silver bg-white p-6">
        <h2 className="font-heading text-lg font-semibold text-charcoal mb-4">
          Profile Photo
        </h2>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-lavender-light flex items-center justify-center text-xl font-semibold text-lavender-dark">
              {firstName?.[0] ?? "?"}
            </div>
          )}
          <div>
            <label className="inline-flex items-center rounded-lg bg-cloud px-4 py-2 text-sm font-medium text-charcoal hover:bg-silver transition-colors cursor-pointer">
              {uploading ? "Uploading..." : "Upload Photo"}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            <p className="mt-1 text-xs text-mist">JPG or PNG, max 2MB</p>
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="rounded-xl border border-silver bg-white p-6 space-y-4">
        <h2 className="font-heading text-lg font-semibold text-charcoal">
          Personal Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            Preferred Name
          </label>
          <input
            type="text"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            placeholder="What should we call you?"
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            Email
          </label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="w-full rounded-lg border border-silver bg-cloud px-3 py-2 text-sm text-mist"
          />
          <p className="mt-1 text-xs text-mist">
            Contact support to change your email address.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(949) 555-0100"
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center rounded-lg bg-lavender px-5 py-2 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved \u2713" : "Save Changes"}
        </button>
      </div>

      {/* Password section */}
      <div id="password" className="rounded-xl border border-silver bg-white p-6 space-y-4">
        <h2 className="font-heading text-lg font-semibold text-charcoal">
          Change Password
        </h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          />
        </div>

        {passwordMsg && (
          <p
            className={`text-sm ${
              passwordMsg.includes("success")
                ? "text-success"
                : "text-error"
            }`}
          >
            {passwordMsg}
          </p>
        )}

        <button
          onClick={handlePasswordChange}
          disabled={passwordSaving || !newPassword}
          className="inline-flex items-center rounded-lg bg-charcoal px-5 py-2 text-sm font-semibold text-white hover:bg-charcoal/80 transition-colors disabled:opacity-50"
        >
          {passwordSaving ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}
