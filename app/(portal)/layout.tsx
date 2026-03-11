import { SignOutButton } from "@/components/layouts/sign-out-button";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-silver bg-white/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-heading text-lg font-semibold text-charcoal">
            Ballet Academy and Movement
          </span>
          <div className="flex items-center gap-3">
            <SignOutButton />
            <div className="h-8 w-8 rounded-full bg-lavender-light" />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

      {/* Bottom tab bar (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-silver bg-white sm:hidden">
        <div className="flex h-14 items-center justify-around text-xs text-slate">
          <a href="/portal/dashboard" className="flex flex-col items-center gap-1 text-lavender">
            <span className="text-base">&#9750;</span>Home
          </a>
          <a href="/portal/schedule" className="flex flex-col items-center gap-1">
            <span className="text-base">&#9783;</span>Schedule
          </a>
          <a href="/portal/learning" className="flex flex-col items-center gap-1">
            <span className="text-base">&#9654;</span>Learn
          </a>
          <a href="/portal/billing" className="flex flex-col items-center gap-1">
            <span className="text-base">&#9733;</span>Billing
          </a>
        </div>
      </nav>
    </div>
  );
}
