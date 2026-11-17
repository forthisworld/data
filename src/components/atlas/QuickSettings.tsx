'use client';

/**
 * The atlas's one menu: theme, the other sections of the site, and the legal
 * pages. There is no cookie banner because the site sets no cookies; the
 * privacy page says what is kept on your device (the theme you pick, and an
 * offline copy of pages you have visited).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X, Sun, Moon, Monitor, Route, FileText, HandHeart, Bot, Shield, Scale, Mail, Github } from 'lucide-react';
import type { ThemeChoice } from '@/lib/theme';

export default function QuickSettings({ country, theme, onTheme }: { country: string; theme: ThemeChoice; onTheme: (t: ThemeChoice) => void }) {
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', away);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
    }, [open]);

    const item = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ftw-text hover:bg-ftw-raised';

    return (
        <div ref={box} className="relative">
            <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Menu and settings"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ftw-line bg-ftw-surface/95 text-ftw-text shadow-sm backdrop-blur hover:bg-ftw-raised">
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {open && (
                <div className="absolute right-0 top-[3.25rem] z-40 max-h-[calc(100dvh-5rem)] w-72 overflow-y-auto rounded-2xl border border-ftw-line bg-ftw-surface p-2 shadow-[0_8px_40px_rgba(0,0,0,0.15)]">
                    <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ftw-muted">Theme</p>
                    <div className="mx-1 mb-2 grid grid-cols-3 gap-1 rounded-xl bg-ftw-raised p-1" role="radiogroup" aria-label="Theme">
                        {([['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'Auto', Monitor]] as const).map(([v, label, Icon]) => (
                            <button key={v} role="radio" aria-checked={theme === v} onClick={() => onTheme(v)}
                                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium ${theme === v ? 'bg-ftw-surface text-ftw-text shadow-sm' : 'text-ftw-muted hover:text-ftw-text'}`}>
                                <Icon className="h-3.5 w-3.5" />{label}
                            </button>
                        ))}
                    </div>

                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ftw-muted">On the map</p>
                    <div className="space-y-1.5 px-3 pb-2 text-xs text-ftw-muted">
                        <p className="flex items-center gap-2"><span className="h-1 w-6 rounded-full bg-ftw-tolled" />Toll road, tolled today</p>
                        <p className="flex items-center gap-2"><span className="h-1 w-6 rounded-full bg-ftw-free" />Toll road, now toll-free</p>
                        <p className="flex items-center gap-2"><span className="h-3 w-6 rounded-sm border border-ftw-accent/40 bg-ftw-accent/10" />State with records</p>
                    </div>

                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ftw-muted">Explore and help</p>
                    <Link href={`/${country}/infrastructure/toll-roads`} className={item}><Route className="h-4 w-4 text-ftw-muted" />All toll roads</Link>
                    <Link href={`/${country}/info-requests`} className={item}><FileText className="h-4 w-4 text-ftw-muted" />RTI questions and drafts</Link>
                    <Link href="/contribute" className={item}><HandHeart className="h-4 w-4 text-ftw-muted" />Contribute</Link>
                    <Link href="/connect" className={item}><Bot className="h-4 w-4 text-ftw-muted" />Use with your AI assistant</Link>

                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ftw-muted">About</p>
                    <Link href="/privacy" className={item}>
                        <Shield className="h-4 w-4 text-ftw-muted" />
                        <span>Privacy and storage<span className="block text-xs text-ftw-muted">No cookies, no tracking</span></span>
                    </Link>
                    <Link href="/licences" className={item}><Scale className="h-4 w-4 text-ftw-muted" />Licences and map credits</Link>
                    <Link href="/contact" className={item}><Mail className="h-4 w-4 text-ftw-muted" />Contact</Link>
                    <a href="https://github.com/forthisworld/data" target="_blank" rel="noopener noreferrer" className={item}><Github className="h-4 w-4 text-ftw-muted" />Source on GitHub</a>
                </div>
            )}
        </div>
    );
}
