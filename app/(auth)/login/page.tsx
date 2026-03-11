export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-heading font-semibold">Welcome Back</h1>
          <p className="mt-2 text-sm text-slate">
            Sign in to Ballet Academy and Movement
          </p>
        </div>
        {/* Supabase Auth form will go here */}
        <div className="rounded-xl border border-silver p-6 bg-white text-center text-sm text-mist">
          Auth form placeholder — Supabase Auth UI
        </div>
      </div>
    </main>
  );
}
