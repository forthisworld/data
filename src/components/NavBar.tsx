'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CompassMark from './CompassMark';
import { isAtlasPathname } from '@/lib/atlas-route';

/** Header for the pages outside the atlas (RTI, contribute, connect, privacy, licences, contact). */
export default function NavBar() {
    const pathname = usePathname();
    if (pathname === '/' || isAtlasPathname(pathname)) return null;
    const link = 'rounded-full px-3 py-1.5 text-sm text-ftw-muted hover:bg-ftw-raised hover:text-ftw-text';
    return (
        <nav className="sticky top-0 z-40 border-b border-ftw-line bg-ftw-surface/90 backdrop-blur">
            <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
                <Link href="/in" className="flex items-center gap-2" title="Back to the atlas">
                    <CompassMark className="h-7 w-7 text-ftw-text" />
                    <span className="text-[15px] font-semibold tracking-tight text-ftw-text">data.ftw</span>
                </Link>
                <div className="flex items-center gap-1">
                    <Link href="/in" className={`${link} hidden sm:inline`}>Atlas</Link>
                    <Link href="/in/info-requests" className={link}>RTI</Link>
                    <Link href="/contribute" className={link}>Contribute</Link>
                    <Link href="/connect" className={`${link} hidden sm:inline`}>Use with AI</Link>
                </div>
            </div>
        </nav>
    );
}
