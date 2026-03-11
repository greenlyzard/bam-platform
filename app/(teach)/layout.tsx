export default function TeachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = [
    { label: "Dashboard", href: "/teach/dashboard" },
    { label: "My Classes", href: "/teach/classes" },
    { label: "Attendance", href: "/teach/attendance" },
    { label: "Badges", href: "/teach/badges" },
    { label: "Assessments", href: "/teach/assessments" },
    { label: "Hours", href: "/teach/hours" },
    { label: "Content", href: "/teach/content" },
    { label: "Messages", href: "/teach/messages" },
  ];

  return (
    <div className="min-h-screen bg-warm-white">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-60 border-r border-silver bg-white sm:block">
        <div className="flex h-14 items-center px-4 border-b border-silver">
          <span className="font-heading text-lg font-semibold text-charcoal">
            Teacher Portal
          </span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate hover:bg-lavender-light hover:text-charcoal transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="sm:ml-60">
        <header className="sticky top-0 z-20 flex h-14 items-center border-b border-silver bg-white/80 backdrop-blur-sm px-6">
          <p className="text-sm text-slate">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
