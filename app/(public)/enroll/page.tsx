import { EnrollmentWizard } from "./enrollment-wizard";
import { getClassCatalog } from "@/lib/queries/enroll";

export const metadata = {
  title: "Enroll — Ballet Academy and Movement",
  description:
    "Find the right class for your child and enroll in under 5 minutes.",
};

export default async function EnrollPage() {
  const classes = await getClassCatalog();

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
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
        <EnrollmentWizard classes={classes} />
      </main>

      {/* Footer */}
      <footer className="border-t border-silver py-6 text-center">
        <p className="text-xs text-mist">
          Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente,
          CA 92672 · (949) 229-0846
        </p>
      </footer>
    </div>
  );
}
