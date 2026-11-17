'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isAtlasPathname } from '@/lib/atlas-route';

/** Footer for the pages outside the atlas. */
export default function Footer() {
    const pathname = usePathname();
    if (pathname === '/' || isAtlasPathname(pathname)) return null;
    return (
        <footer className="border-t border-ftw-line bg-ftw-bg">
            <div className="container mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ftw-muted">
                <p>data.ftw by ForThisWorld · data ODbL, code MIT</p>
                <div className="flex flex-wrap gap-4">
                    <Link href="/privacy" className="hover:text-ftw-text">Privacy</Link>
                    <Link href="/licences" className="hover:text-ftw-text">Licences</Link>
                    <Link href="/contact" className="hover:text-ftw-text">Contact</Link>
                    <a href="https://github.com/forthisworld/data" target="_blank" rel="noopener noreferrer" className="hover:text-ftw-text">GitHub</a>
                </div>
            </div>
        </footer>
    );
}
