export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-40 border-b border-silver bg-white/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4 max-w-5xl mx-auto">
          <a href="/" className="font-heading text-lg font-semibold text-charcoal">
            Studio Shop
          </a>
          <div className="flex items-center gap-4">
            <a href="/portal/dashboard" className="text-sm text-slate hover:text-charcoal">
              Back to Portal
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
