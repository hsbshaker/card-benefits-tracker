import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-xl font-semibold text-white">Sign-in failed</h1>
        <p className="text-sm text-white/70">We could not complete Google sign-in. Please try again.</p>
        <Link
          href="/login"
          className="inline-flex rounded-md border border-white/20 px-4 py-2 text-sm text-white transition hover:border-white/40"
        >
          Back to login
        </Link>
      </div>
    </main>
  );
}
