'use client';

import dynamic from 'next/dynamic';
import type { AtlasRegion } from '@/services/country.service';

// MapLibre needs the browser (WebGL), so the atlas renders on the client only.
const Atlas = dynamic(() => import('./Atlas'), {
    ssr: false,
    loading: () => (
        <div className="flex h-[100dvh] items-center justify-center bg-[#bcd8e3] font-[family-name:var(--font-atlas)] text-lg italic text-[#4a3b2c]">
            Unrolling the map…
        </div>
    ),
});

export default function AtlasLoader(props: { countryCode: string; countryName: string; regions: Record<string, AtlasRegion> }) {
    return <Atlas {...props} />;
}
