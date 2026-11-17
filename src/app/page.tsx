'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root page - redirects to /in (India) by default
 * Future: Could show country selector with India prominent
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to India dashboard
    router.replace('/in');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to India Dashboard...</p>
      </div>
    </div>
  );
}
