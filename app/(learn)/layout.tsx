export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-charcoal text-white">
      {/* Minimal chrome for immersive learning */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-12 items-center justify-between px-4 bg-gradient-to-b from-charcoal/80 to-transparent">
        <a href="/portal/dashboard" className="text-sm text-white/70 hover:text-white">
          &larr; Back
        </a>
        <div className="flex items-center gap-4">
          <a href="/learn/progress" className="text-sm text-white/70 hover:text-white">
            Progress
          </a>
        </div>
      </header>

      <main>{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-charcoal/90 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-around text-xs text-white/60">
          <a href="/learn" className="flex flex-col items-center gap-1 text-gold">
            <span className="text-base">&#9654;</span>Feed
          </a>
          <a href="/learn/progress" className="flex flex-col items-center gap-1">
            <span className="text-base">&#10022;</span>Progress
          </a>
          <a href="/learn/favorites" className="flex flex-col items-center gap-1">
            <span className="text-base">&#9829;</span>Favorites
          </a>
          <a href="/learn/live" className="flex flex-col items-center gap-1">
            <span className="text-base">&#9673;</span>Live
          </a>
        </div>
      </nav>
    </div>
  );
}
