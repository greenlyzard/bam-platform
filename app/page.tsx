import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <Image
        src="/studio-logo.png"
        alt="Ballet Academy & Movement"
        width={700}
        height={400}
        className="h-auto w-full max-w-[280px] mb-6"
        priority
      />
      <h1 className="text-4xl md:text-5xl font-heading font-semibold text-charcoal text-center">
        Ballet Academy &amp; Movement
      </h1>
      <p className="mt-4 text-lg text-slate text-center max-w-lg">
        Real ballet training in a nurturing environment.
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/portal/dashboard"
          className="px-6 py-2.5 bg-lavender hover:bg-lavender-dark text-white font-semibold rounded-lg text-sm tracking-wide transition-colors"
        >
          Parent Portal
        </a>
        <a
          href="/admin/dashboard"
          className="px-6 py-2.5 border-2 border-lavender text-lavender hover:bg-lavender hover:text-white font-semibold rounded-lg text-sm tracking-wide transition-colors"
        >
          Admin
        </a>
      </div>
    </main>
  );
}
