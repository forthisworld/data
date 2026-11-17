import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'data.ftw: an open atlas of public money',
        short_name: 'data.ftw',
        description: "An open atlas of public money in India: what was built, what it cost, who answers for it, and what is still unknown, with every fact linked to its source.",
        start_url: '/in',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#eef1f4',
        theme_color: '#eef1f4',
        categories: ['government', 'news', 'reference'],
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
    };
}
