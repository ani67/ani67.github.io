import Link from 'next/link';

/**
 * Custom 404 Not Found page
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-ink flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-normal mb-4 font-[family-name:var(--font-mondwest)]">404</h1>
        <h2 className="text-2xl mb-8">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-ink text-black rounded hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-black"
        >
          Go back home
        </Link>
      </div>
    </div>
  );
}
