'use client';

/**
 * The panel that holds detail. On wide screens: a tall card down the left of
 * the map. On phones: a drawer from the bottom with three heights (peek, half,
 * full) that you drag between; drag it below peek to close.
 */

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export type Snap = 'peek' | 'half' | 'full';
export const PEEK_PX = 148;

const heightFor = (snap: Snap, vh: number) => (snap === 'peek' ? PEEK_PX : snap === 'half' ? Math.round(vh * 0.52) : vh - 64);

export function useWide() {
    const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 768px)');
        const on = () => setWide(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return wide;
}

export default function Sheet({ wide, snap, onSnap, onClose, viewKey, children }: {
    wide: boolean;
    snap: Snap;
    onSnap: (s: Snap) => void;
    onClose: () => void;
    /** Changes when the content changes, to scroll back to the top. */
    viewKey: string;
    children: React.ReactNode;
}) {
    const scroller = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<number | null>(null);
    const start = useRef<{ y: number; h: number } | null>(null);
    const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));

    useEffect(() => {
        const on = () => setVh(window.innerHeight);
        window.addEventListener('resize', on);
        return () => window.removeEventListener('resize', on);
    }, []);
    useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [viewKey]);

    const close = (
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full bg-ftw-raised p-1.5 text-ftw-muted hover:text-ftw-text">
            <X className="h-4 w-4" />
        </button>
    );

    if (wide) {
        return (
            <aside className="absolute bottom-4 left-4 top-[4.5rem] z-20 flex w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-ftw-line bg-ftw-surface text-ftw-text shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
                {close}
                <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain pt-4">{children}</div>
            </aside>
        );
    }

    const h = drag ?? heightFor(snap, vh);
    const onDown = (e: React.PointerEvent) => {
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
        start.current = { y: e.clientY, h: heightFor(snap, vh) };
        setDrag(start.current.h);
    };
    const onMove = (e: React.PointerEvent) => {
        if (!start.current) return;
        setDrag(Math.max(60, Math.min(vh - 40, start.current.h + start.current.y - e.clientY)));
    };
    const onUp = (e: React.PointerEvent) => {
        if (!start.current) return;
        const moved = Math.abs(e.clientY - start.current.y);
        const end = drag ?? start.current.h;
        start.current = null;
        setDrag(null);
        if (moved < 6) { // a tap on the handle steps up, then back to peek
            onSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek');
            return;
        }
        if (end < PEEK_PX - 50) return onClose();
        const snaps: Snap[] = ['peek', 'half', 'full'];
        onSnap(snaps.reduce((best, s) => (Math.abs(heightFor(s, vh) - end) < Math.abs(heightFor(best, vh) - end) ? s : best), 'peek'));
    };

    return (
        <aside style={{ height: h }}
            className={`absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-2xl border-t border-ftw-line bg-ftw-surface text-ftw-text shadow-[0_-8px_30px_rgba(0,0,0,0.15)] ${drag === null ? 'transition-[height] duration-200 ease-out' : ''}`}>
            <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center" role="slider" aria-label="Drag to resize" aria-valuemin={0} aria-valuemax={2} aria-valuenow={snap === "peek" ? 0 : snap === "half" ? 1 : 2} aria-valuetext={snap}>
                <span className="h-1 w-10 rounded-full bg-ftw-line" />
            </div>
            {close}
            <div ref={scroller} className={`flex-1 overscroll-contain pb-[env(safe-area-inset-bottom)] ${snap === 'peek' && drag === null ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                {children}
            </div>
        </aside>
    );
}
