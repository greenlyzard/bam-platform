import { getClassCatalog } from "@/lib/queries/enroll";
import { ClassCatalog } from "./class-catalog";

export const metadata = {
  title: "Class Catalog — Ballet Academy and Movement",
  description:
    "Browse all classes offered at Ballet Academy and Movement in San Clemente, CA.",
};

export default async function ClassCatalogPage() {
  const classes = await getClassCatalog();

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-lavender py-6">
        <div className="mx-auto max-w-4xl px-4">
          <a href="/" className="inline-block">
            <h1 className="font-heading text-xl font-semibold text-white tracking-wide">
              Ballet Academy and Movement
            </h1>
          </a>
          <p className="mt-1 text-sm text-white/80">Class Catalog</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h2 className="font-heading text-2xl font-semibold text-charcoal">
            All Classes
          </h2>
          <p className="mt-1 text-sm text-slate">
            Browse our current schedule. Tap a class to enroll or book a trial.
          </p>
        </div>

        <ClassCatalog classes={classes} />
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
