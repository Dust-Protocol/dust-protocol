import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#06080F] flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-[400px]">
        <p className="text-[11px] font-mono font-bold tracking-[0.25em] text-[#00FF41] uppercase mb-4">
          404_NOT_FOUND
        </p>
        <h1 className="text-4xl font-bold text-white font-mono mb-3">
          Page not found
        </h1>
        <p className="text-sm text-[rgba(255,255,255,0.4)] font-mono mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-sm bg-[#00FF41] hover:bg-[rgba(0,255,65,0.85)] transition-all font-mono font-bold text-sm text-black"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
