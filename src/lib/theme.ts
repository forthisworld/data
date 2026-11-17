'use client';

import { useCallback, useEffect, useState } from 'react';

/** The visitor's choice, kept in localStorage (see the pre-paint script in app/layout.tsx). */
export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'ftw-theme';

function read(): ThemeChoice {
    try {
        const v = localStorage.getItem(KEY);
        return v === 'dark' || v === 'system' ? v : 'light';
    } catch {
        return 'light';
    }
}

const systemDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

/** Current choice, the theme actually shown, and a setter that persists it. */
export function useTheme() {
    // Start from what the pre-paint script already applied, so nothing flips on mount.
    const [choice, setChoice] = useState<ThemeChoice>(() => (typeof window === 'undefined' ? 'light' : read()));
    const [dark, setDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

    // Follow the OS while "system" is chosen.
    useEffect(() => {
        if (choice !== 'system') return;
        const mq = matchMedia('(prefers-color-scheme: dark)');
        const on = () => setDark(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, [choice]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
    }, [dark]);

    const set = useCallback((c: ThemeChoice) => {
        try { localStorage.setItem(KEY, c); } catch { /* private mode: still switch for this visit */ }
        setChoice(c);
        setDark(c === 'dark' || (c === 'system' && systemDark()));
    }, []);

    return { choice, dark, setTheme: set };
}
