'use client';

import dynamic from 'next/dynamic';
import type { AtlasData } from '@/services/country.service';

// MapLibre needs the browser (WebGL), so the atlas renders on the client only.
const Atlas = dynamic(() => import('./Atlas'), {
    ssr: false,
    loading: () => (
        <div className="flex h-[100dvh] items-center justify-center bg-ftw-bg text-sm text-ftw-muted">Loading the map…</div>
    ),
});

export default function AtlasLoader(props: { countryCode: string; countryName: string; data: AtlasData }) {
    return <Atlas {...props} />;
}
