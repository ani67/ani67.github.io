'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary component for handling runtime errors
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console (can be replaced with error tracking service)
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-normal mb-4 font-[family-name:var(--font-mondwest)]">Something went wrong!</h1>
        <p className="text-gray-400 mb-2">
          An error occurred while loading this page.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-4 p-4 bg-gray-900 rounded text-left text-xs overflow-auto max-h-40 text-red-400">
            {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          className="mt-8 inline-block px-6 py-3 bg-white text-black rounded hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
