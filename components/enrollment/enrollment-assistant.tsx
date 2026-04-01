"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const CONTACT_INFO = {
  phone: "(949) 229-0846",
  phoneHref: "tel:9492290846",
  sms: "sms:9492290846",
  email: "dance@bamsocal.com",
  emailHref: "mailto:dance@bamsocal.com",
};

const STEP_MESSAGES: Record<string, string> = {
  "/enroll": "Hi! I'm here to help you find the perfect class. What questions do you have?",
  "/enroll/classes": "Need help choosing a class? I can help narrow it down by age or style.",
  "/enroll/cart": "Have questions about pricing or scheduling? I'm here to help!",
  "/enroll/checkout": "Questions before you complete enrollment? Call or text us.",
  "/enroll/confirmation": "You're all set! We'll be in touch soon. Any questions?",
};

export default function EnrollmentAssistant() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const message =
    Object.entries(STEP_MESSAGES)
      .reverse()
      .find(([path]) => pathname.startsWith(path))?.[1] ??
    STEP_MESSAGES["/enroll"];

  return (
    <div className="fixed bottom-6 right-6 z-50 print:hidden">
      {open && (
        <div className="mb-3 w-72 bg-white rounded-2xl shadow-xl border border-silver overflow-hidden">
          <div className="bg-lavender px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm">
              B
            </div>
            <div>
              <div className="text-white font-medium text-sm">
                Ballet Academy &amp; Movement
              </div>
              <div className="text-white/70 text-xs">
                We typically reply instantly
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-charcoal">{message}</p>
          </div>
          <div className="px-4 pb-4 space-y-2">
            <a
              href={CONTACT_INFO.sms}
              className="flex items-center gap-3 p-3 rounded-xl bg-lavender/5 hover:bg-lavender/10 transition-colors text-sm text-charcoal"
            >
              <span className="text-lg leading-none">&#x1F4AC;</span>
              <div>
                <div className="font-medium">Text Us</div>
                <div className="text-xs text-mist">{CONTACT_INFO.phone}</div>
              </div>
            </a>
            <a
              href={CONTACT_INFO.phoneHref}
              className="flex items-center gap-3 p-3 rounded-xl bg-lavender/5 hover:bg-lavender/10 transition-colors text-sm text-charcoal"
            >
              <span className="text-lg leading-none">&#x1F4DE;</span>
              <div>
                <div className="font-medium">Call Us</div>
                <div className="text-xs text-mist">{CONTACT_INFO.phone}</div>
              </div>
            </a>
            <a
              href={CONTACT_INFO.emailHref}
              className="flex items-center gap-3 p-3 rounded-xl bg-lavender/5 hover:bg-lavender/10 transition-colors text-sm text-charcoal"
            >
              <span className="text-lg leading-none">&#x2709;</span>
              <div>
                <div className="font-medium">Email Us</div>
                <div className="text-xs text-mist">{CONTACT_INFO.email}</div>
              </div>
            </a>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 bg-lavender rounded-full shadow-lg flex items-center justify-center text-white text-xl hover:opacity-90 transition-all hover:scale-105"
        aria-label="Contact us"
      >
        {open ? "✕" : "?"}
      </button>
    </div>
  );
}
