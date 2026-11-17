'use client';

import { useEffect } from 'react';

/** Registers /sw.js in production so the atlas can be installed and used offline. */
export default function ServiceWorker() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Not fatal: the site works without it.
        });
    }, []);
    return null;
}
