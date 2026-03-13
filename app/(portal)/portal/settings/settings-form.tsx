"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  updateProfile,
  changeEmail,
  setPassword,
  uploadAvatar,
} from "./actions";

interface SettingsFormProps {
  profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
  };
}

export function SettingsForm({ profile }: SettingsFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile section
  const [profileMsg, setProfileMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Email section
  const [emailMsg, setEmailMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);

  // Password section
  const [passwordMsg, setPasswordMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Avatar section
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const initials =
    (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? "");

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    const fd = new FormData(e.currentTarget);
    const result = await updateProfile(fd);
    setProfileSaving(false);
    if ("error" in result && result.error) {
      setProfileMsg({ type: "error", text: result.error });
    } else {
      setProfileMsg({ type: "success", text: "Profile updated." });
      router.refresh();
    }
  }

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailSaving(true);
    setEmailMsg(null);
    const fd = new FormData(e.currentTarget);
    const result = await changeEmail(fd);
    setEmailSaving(false);
    if ("error" in result && result.error) {
      setEmailMsg({ type: "error", text: result.error });
    } else {
      setEmailMsg({
        type: "success",
        text:
          ("message" in result && result.message) ||
          "Check your new email for a verification link.",
      });
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMsg(null);
    const fd = new FormData(e.currentTarget);
    const result = await setPassword(fd);
    setPasswordSaving(false);
    if ("error" in result && result.error) {
      setPasswordMsg({ type: "error", text: result.error });
    } else {
      setPasswordMsg({
        type: "success",
        text: "Password set. You can now sign in with your email and password.",
      });
      e.currentTarget.reset();
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const fd = new FormData();
    fd.set("avatar", file);
    const result = await uploadAvatar(fd);
    setAvatarUploading(false);
    if ("error" in result && result.error) {
      setProfileMsg({ type: "error", text: result.error });
    } else if ("avatar_url" in result && result.avatar_url) {
      setAvatarUrl(result.avatar_url);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* ── Avatar & Profile ── */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          Profile
        </h2>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative h-16 w-16 rounded-full overflow-hidden bg-lavender-light flex items-center justify-center shrink-0 hover:ring-2 hover:ring-lavender transition-all group"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-lavender-dark">
                {initials || "?"}
              </span>
            )}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-medium">Edit</span>
            </div>
          </button>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="text-sm text-lavender hover:text-lavender-dark font-medium disabled:opacity-50"
            >
              {avatarUploading ? "Uploading..." : "Change photo"}
            </button>
            <p className="text-xs text-mist mt-0.5">
              JPEG, PNG, or WebP. Max 2MB.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        {/* Profile fields */}
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {profileMsg && (
            <StatusMessage type={profileMsg.type} text={profileMsg.text} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                First Name *
              </label>
              <input
                name="first_name"
                required
                defaultValue={profile.first_name}
                className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Last Name *
              </label>
              <input
                name="last_name"
                required
                defaultValue={profile.last_name}
                className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              Phone
            </label>
            <input
              name="phone"
              type="tel"
              defaultValue={profile.phone}
              placeholder="(555) 123-4567"
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={profileSaving}
            className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors disabled:opacity-50"
          >
            {profileSaving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>

      {/* ── Email ── */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          Email Address
        </h2>
        <p className="text-sm text-slate">
          Current email: <span className="font-medium">{profile.email}</span>
        </p>
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {emailMsg && (
            <StatusMessage type={emailMsg.type} text={emailMsg.text} />
          )}
          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              New Email Address
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="newemail@example.com"
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
            />
          </div>
          <p className="text-xs text-mist">
            A verification link will be sent to your new email address.
          </p>
          <button
            type="submit"
            disabled={emailSaving}
            className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors disabled:opacity-50"
          >
            {emailSaving ? "Sending..." : "Change Email"}
          </button>
        </form>
      </div>

      {/* ── Password ── */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          Set Password
        </h2>
        <p className="text-sm text-slate">
          Set or change your password. Once set, you can sign in using either
          your magic link or your email and password.
        </p>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {passwordMsg && (
            <StatusMessage type={passwordMsg.type} text={passwordMsg.text} />
          )}
          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              New Password
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              Confirm Password
            </label>
            <input
              name="confirm_password"
              type="password"
              required
              minLength={8}
              placeholder="Confirm your password"
              className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={passwordSaving}
            className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors disabled:opacity-50"
          >
            {passwordSaving ? "Setting..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function StatusMessage({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  const colors =
    type === "success"
      ? "bg-[#5A9E6F]/10 border-[#5A9E6F]/20 text-[#5A9E6F]"
      : "bg-[#C45B5B]/10 border-[#C45B5B]/20 text-[#C45B5B]";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${colors}`}>
      {text}
    </div>
  );
}
