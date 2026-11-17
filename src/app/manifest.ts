import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'data.ftw: an open atlas of public money',
        short_name: 'data.ftw',
        description: "India's governance data on a map: toll roads, who built them, what they cost and what they earned, with every fact linked to its source.",
        start_url: '/in',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#bcd8e3',
        theme_color: '#1f3a4d',
        categories: ['government', 'news', 'reference'],
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
    };
}
