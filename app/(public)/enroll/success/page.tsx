import { Suspense } from "react";
import { SuccessView } from "./success-view";

export const metadata = {
  title: "You're Enrolled! — Ballet Academy and Movement",
  description: "Your enrollment is confirmed.",
};

export default function SuccessPage() {
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
        <Suspense
          fallback={
            <div className="text-center py-16">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
              <p className="mt-4 text-sm text-slate">
                Confirming your enrollment...
              </p>
            </div>
          }
        >
          <SuccessView />
        </Suspense>
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
