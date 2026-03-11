export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navGroups = [
    {
      label: "Studio",
      items: [
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Seasons", href: "/admin/seasons" },
        { label: "Classes", href: "/admin/classes" },
        { label: "Students", href: "/admin/students" },
        { label: "Families", href: "/admin/families" },
      ],
    },
    {
      label: "Staff",
      items: [
        { label: "Teachers", href: "/admin/teachers" },
        { label: "Compliance", href: "/admin/compliance" },
      ],
    },
    {
      label: "Productions",
      items: [
        { label: "Performances", href: "/admin/performances" },
      ],
    },
    {
      label: "Communications",
      items: [
        { label: "Announcements", href: "/admin/communications" },
      ],
    },
    {
      label: "Commerce",
      items: [
        { label: "Billing", href: "/admin/billing" },
        { label: "Reports", href: "/admin/reports" },
      ],
    },
    {
      label: "Content",
      items: [
        { label: "LMS Content", href: "/admin/content" },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { label: "Expansion", href: "/admin/expansion" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-warm-white">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 overflow-y-auto border-r border-silver bg-white lg:block">
        <div className="flex h-14 items-center px-4 border-b border-silver">
          <span className="font-heading text-lg font-semibold text-charcoal">
            Admin
          </span>
        </div>
        <nav className="p-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-mist">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate hover:bg-lavender-light hover:text-charcoal transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-silver bg-white/80 backdrop-blur-sm px-6">
          <div className="flex items-center gap-3">
            {/* Search placeholder */}
            <div className="hidden sm:flex items-center h-9 w-64 rounded-lg border border-silver bg-cloud px-3 text-sm text-mist">
              Search...
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-lavender-light" />
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
