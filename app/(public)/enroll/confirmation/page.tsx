import { EnrollmentConfirmation } from "./confirmation-view";

export const metadata = {
  title: "Enrollment Confirmed — Ballet Academy and Movement",
  description: "Your enrollment has been confirmed.",
};

export default function ConfirmationPage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-lavender py-6">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <a href="/" className="inline-block">
            <h1 className="font-heading text-xl font-semibold text-white tracking-wide">
              Ballet Academy and Movement
            </h1>
          </a>
          <p className="mt-1 text-sm text-white/80">
            San Clemente, California
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <EnrollmentConfirmation />
      </main>

      <footer className="border-t border-silver py-6 text-center">
        <p className="text-xs text-mist">
          Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente,
          CA 92672 · (949) 229-0846
        </p>
      </footer>
    </div>
  );
}
