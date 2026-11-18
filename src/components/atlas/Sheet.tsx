'use client';

/**
 * The panel that holds detail. On wide screens: a tall card down the left of
 * the map. On phones: a drawer from the bottom with three heights (peek, half,
 * full).
 *
 * The drawer follows the finger from anywhere on it, not only the handle:
 *   - below full height, dragging the drawer anywhere moves the drawer (the content does not scroll yet);
 *   - at full height the content scrolls, and pulling down from the top of the content lowers the drawer;
 *   - a quick flick goes one height up or down, a slow drag settles on the nearest height;
 *   - a flick down from peek, or a drag well below it, closes the drawer;
 *   - a tap on the handle steps up (peek, half, full) and then back to peek; a tap on the peeking drawer opens it.
 */

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export type Snap = 'peek' | 'half' | 'full';
export const PEEK_PX = 148;

const SNAPS: Snap[] = ['peek', 'half', 'full'];
const heightFor = (snap: Snap, vh: number) => (snap === 'peek' ? PEEK_PX : snap === 'half' ? Math.round(vh * 0.52) : vh - 64);
/** Faster than this (px per ms) is a flick: go one height in that direction. */
const FLICK = 0.45;
/** A touch that moves less than this is a tap, not a drag. */
const SLOP = 8;

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

export default function Sheet({ wide, snap, onSnap, onClose, viewKey, above, children }: {
    wide: boolean;
    snap: Snap;
    onSnap: (s: Snap) => void;
    onClose: () => void;
    /** Changes when the content changes, to scroll back to the top. */
    viewKey: string;
    /** Phones: a small line that rides on the map just above the drawer (the map credit). */
    above?: React.ReactNode;
    children: React.ReactNode;
}) {
    const sheet = useRef<HTMLElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const handle = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<number | null>(null);
    const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
    // The gesture handlers are bound once; they read the latest values from here.
    const live = useRef({ snap, vh, onSnap, onClose });
    live.current = { snap, vh, onSnap, onClose };

    useEffect(() => {
        const on = () => setVh(window.innerHeight);
        window.addEventListener('resize', on);
        return () => window.removeEventListener('resize', on);
    }, []);
    useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [viewKey]);

    // Escape closes the panel (not while typing in the search box, where it clears the search).
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) live.current.onClose();
        };
        document.addEventListener('keydown', key);
        return () => document.removeEventListener('keydown', key);
    }, []);

    // Where a released drag ends up: a flick moves one height, a slow drag takes the nearest.
    const settle = (height: number, velocity: number) => {
        const { snap: from, vh: h, onSnap: to, onClose: close } = live.current;
        const i = SNAPS.indexOf(from);
        if (velocity > FLICK) return to(SNAPS[Math.min(SNAPS.length - 1, i + 1)]);
        if (velocity < -FLICK) return i === 0 ? close() : to(SNAPS[i - 1]);
        if (height < PEEK_PX - 50) return close();
        to(SNAPS.reduce((best, s) => (Math.abs(heightFor(s, h) - height) < Math.abs(heightFor(best, h) - height) ? s : best), 'peek' as Snap));
    };
    const step = () => { const s = live.current.snap; live.current.onSnap(s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'); };

    // Touch: the whole drawer is the grab area. Bound natively because the move handler must be able
    // to stop the browser's own scrolling, which React's passive touch listeners cannot.
    useEffect(() => {
        const el = sheet.current;
        if (!el || wide) return;
        let start: { y: number; h: number; onHandle: boolean; scrollTop: number } | null = null;
        let dragging = false;
        let height = 0;
        let trail: { y: number; t: number }[] = [];

        const down = (e: TouchEvent) => {
            if (e.touches.length !== 1) { start = null; return; }
            const { snap: s, vh: h } = live.current;
            start = { y: e.touches[0].clientY, h: heightFor(s, h), onHandle: !!handle.current?.contains(e.target as Node), scrollTop: scroller.current?.scrollTop ?? 0 };
            dragging = false;
            height = start.h;
            trail = [{ y: start.y, t: e.timeStamp }];
        };
        const move = (e: TouchEvent) => {
            if (!start) return;
            const y = e.touches[0].clientY;
            const dy = start.y - y; // up is positive
            if (!dragging) {
                if (Math.abs(dy) < SLOP) return;
                // At full height the content scrolls; only a pull down from its top moves the drawer.
                const full = live.current.snap === 'full';
                if (full && !start.onHandle && !(dy < 0 && start.scrollTop <= 0)) { start = null; return; }
                dragging = true;
            }
            e.preventDefault();
            height = Math.max(60, Math.min(live.current.vh - 40, start.h + dy));
            trail.push({ y, t: e.timeStamp });
            if (trail.length > 6) trail.shift();
            setDrag(height);
        };
        const up = (e: TouchEvent) => {
            if (!start) return;
            const was = dragging, onHandle = start.onHandle;
            start = null;
            dragging = false;
            setDrag(null);
            if (!was) { if (onHandle) { e.preventDefault(); step(); } return; }
            e.preventDefault(); // no click on whatever was under the finger
            const a = trail[0], b = trail[trail.length - 1];
            settle(height, b.t > a.t ? (a.y - b.y) / (b.t - a.t) : 0);
        };
        const cancel = () => { start = null; dragging = false; setDrag(null); };
        el.addEventListener('touchstart', down, { passive: true });
        el.addEventListener('touchmove', move, { passive: false });
        el.addEventListener('touchend', up, { passive: false });
        el.addEventListener('touchcancel', cancel);
        return () => {
            el.removeEventListener('touchstart', down);
            el.removeEventListener('touchmove', move);
            el.removeEventListener('touchend', up);
            el.removeEventListener('touchcancel', cancel);
        };
        // Bound once per layout; everything else is read from `live`.
    }, [wide]);

    // Mouse (a narrow desktop window): drag the handle.
    const mouse = useRef<{ y: number; h: number; t: number; moved: boolean } | null>(null);
    const onDown = (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
        mouse.current = { y: e.clientY, h: heightFor(snap, vh), t: e.timeStamp, moved: false };
    };
    const onMove = (e: React.PointerEvent) => {
        const m = mouse.current;
        if (!m) return;
        if (Math.abs(e.clientY - m.y) >= SLOP) m.moved = true;
        if (m.moved) setDrag(Math.max(60, Math.min(vh - 40, m.h + m.y - e.clientY)));
    };
    const onUp = (e: React.PointerEvent) => {
        const m = mouse.current;
        if (!m) return;
        mouse.current = null;
        const end = drag ?? m.h;
        setDrag(null);
        if (!m.moved) return step();
        settle(end, e.timeStamp > m.t ? (m.y - e.clientY) / (e.timeStamp - m.t) : 0);
    };

    const close = (
        <button onClick={onClose} aria-label="Close" className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-ftw-raised text-ftw-muted hover:text-ftw-text">
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
    const ease = drag === null ? 'duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]' : '';
    const full = snap === 'full' && drag === null;
    return (
        <>
            {above && snap !== 'full' && (
                <div style={{ bottom: h + 6 }} className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-3 ${ease ? `transition-[bottom] ${ease}` : ''}`}>
                    <span className="pointer-events-auto">{above}</span>
                </div>
            )}
            <aside ref={sheet} style={{ height: h }}
                className={`absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-[20px] border-t border-ftw-line bg-ftw-surface text-ftw-text shadow-[0_-8px_30px_rgba(0,0,0,0.15)] ${full ? '' : 'touch-none'} ${ease ? `transition-[height] ${ease}` : ''}`}>
                <div ref={handle} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                    className="flex h-8 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
                    role="slider" tabIndex={0} aria-label="Drawer height: drag, or press Enter to change" aria-valuemin={0} aria-valuemax={2} aria-valuenow={SNAPS.indexOf(snap)} aria-valuetext={snap}
                    onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(); }
                        if (e.key === 'ArrowUp') { e.preventDefault(); onSnap(SNAPS[Math.min(2, SNAPS.indexOf(snap) + 1)]); }
                        if (e.key === 'ArrowDown') { e.preventDefault(); onSnap(SNAPS[Math.max(0, SNAPS.indexOf(snap) - 1)]); }
                    }}>
                    <span className="h-[5px] w-11 rounded-full bg-ftw-faint/50" />
                </div>
                {close}
                {/* Scrolls only at full height; below that a drag moves the drawer, and a tap on the peek opens it. */}
                <div ref={scroller} onClick={snap === 'peek' ? () => onSnap('half') : undefined}
                    className={`flex-1 overscroll-contain pb-[env(safe-area-inset-bottom)] ${full ? 'touch-pan-y overflow-y-auto' : 'overflow-hidden'}`}>
                    {children}
                </div>
            </aside>
        </>
    );
}
