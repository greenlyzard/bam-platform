import { EnrollmentCartView } from "./cart-view";

export const metadata = {
  title: "Your Cart — Ballet Academy and Movement",
  description: "Review your selected classes and proceed to checkout.",
};

export default function CartPage() {
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
        <EnrollmentCartView />
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
